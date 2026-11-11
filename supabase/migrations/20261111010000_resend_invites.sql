-- Resend an invite (Venkat, 2026-11-11). A first invite email can bounce, land in spam, hit
-- the SMTP limit or its 6-digit code can expire; a WhatsApp code expires after 7 days.
-- Inviting the same email again used to be the only way out, and it gave the invite to
-- whoever resent it (invited_by), which also moved a trainer's member to someone else.
-- Now the Invited list resends the same invite, keeping who invited them and the details.

-- What the last invite email did, so the Invited list can say "email failed", and a cap so
-- Resend can't flood someone's inbox or use up the SMTP provider's hourly limit.
alter table public.gym_invites
  add column email_tried_at timestamptz,
  add column email_error text check (char_length(email_error) <= 300),
  add column email_sends smallint not null default 0,
  add column email_sends_on date;

-- Platform admins see the owner invite of a gym they set up (the admin branch screen).
create policy "Platform admins read invites" on public.gym_invites
  for select using (public.is_platform_admin());

-- Resends one pending invite, as the caller. p_channel 'email' only checks it can be emailed
-- (invite-member sends it); 'whatsapp' gives back its join code, renewing an expired one
-- for 7 more days. Who can resend matches who can withdraw it: owners any, supervisors
-- member and trainer invites, trainers the member invites they sent, admins any.
-- Returns 'invited', 'invited_in_app' (they made an account since; the inbox invite is sent
-- again) or 'already_member' (they're in; the leftover invite is removed).
create function public.resend_gym_invite(p_invite_id uuid, p_channel text)
returns table (
  gym_id uuid, email text, role text, email_role text, result text, code text,
  code_expires_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
declare
  v_invite public.gym_invites;
  v_user_id uuid;
  v_gym text;
begin
  if p_channel not in ('email', 'whatsapp') then
    raise exception 'Unknown channel';
  end if;
  select * into v_invite from public.gym_invites i where i.id = p_invite_id;
  if v_invite.id is null then
    raise exception 'This invite was withdrawn or already used';
  end if;
  if not (
    public.is_platform_admin()
    or public.has_gym_role(v_invite.gym_id, array['owner']) and v_invite.role <> 'owner'
    or public.has_gym_role(v_invite.gym_id, array['supervisor'])
       and v_invite.role in ('member', 'trainer')
    or public.has_gym_role(v_invite.gym_id, array['trainer'])
       and v_invite.role = 'member' and v_invite.invited_by = auth.uid()
  ) then
    raise exception 'You can''t resend this invite';
  end if;

  gym_id := v_invite.gym_id;
  email := v_invite.email;
  role := v_invite.role;
  -- The admin's first owner of a new gym gets the "Gym owner" email, a co-owner the other.
  email_role := case
    when v_invite.role = 'owner' and not exists (
      select 1 from public.gym_members gm
      where gm.gym_id = v_invite.gym_id and gm.role = 'owner' and gm.status = 'active'
    ) then 'gym_owner'
    else v_invite.role
  end;
  code := null;
  code_expires_at := null;

  select u.id into v_user_id from auth.users u
    where lower(u.email) = v_invite.email and u.email_confirmed_at is not null;
  if v_user_id is not null then
    if exists (
      select 1 from public.gym_members gm
      where gm.gym_id = v_invite.gym_id and gm.user_id = v_user_id
    ) then
      delete from public.gym_invites i where i.id = v_invite.id;
      result := 'already_member';
      return next;
      return;
    end if;
    -- They have an account now: they accept in the app. One inbox invite a day.
    select g.name into v_gym from public.gyms g where g.id = v_invite.gym_id;
    insert into public.notifications (gym_id, recipient_id, sender_id, kind, title, body, dedupe_key)
    values (
      v_invite.gym_id, v_user_id, auth.uid(), 'invite', 'Gym invite',
      left(coalesce(v_gym, 'A gym') || ' invited you to join. Open CoreFit to accept.', 500),
      'gym-invite:' || v_invite.gym_id || ':' || now()::date
    )
    on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
    result := 'invited_in_app';
    return next;
    return;
  end if;

  result := 'invited';
  if p_channel = 'email' then
    if v_invite.email like '%@m.vinven.net' then
      raise exception 'They have no email. Resend it on WhatsApp.';
    end if;
  else
    if v_invite.code is null or v_invite.code_expires_at < now() then
      code := public.new_invite_code();
      code_expires_at := now() + interval '7 days';
      update public.gym_invites i
        set code = resend_gym_invite.code, code_expires_at = resend_gym_invite.code_expires_at
        where i.id = v_invite.id;
    else
      code := v_invite.code;
      code_expires_at := v_invite.code_expires_at;
    end if;
  end if;
  return next;
end;
$$;
revoke execute on function public.resend_gym_invite(uuid, text) from public, anon;
grant execute on function public.resend_gym_invite(uuid, text) to authenticated;

-- invite-member (service role) asks before every invite email. Null means go ahead;
-- otherwise the reason it can't go yet. One a minute (Supabase's own email gap) and 5 a day.
create function public.invite_email_wait(p_gym_id uuid, p_email text) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when i.email_tried_at > now() - interval '1 minute'
      then 'Sent just now. Wait a minute, then resend.'
    when i.email_sends_on = current_date and i.email_sends >= 5
      then 'Emailed 5 times today. Try tomorrow, or send it on WhatsApp.'
  end
  from public.gym_invites i
  where i.gym_id = p_gym_id and i.email = lower(trim(p_email))
$$;
revoke execute on function public.invite_email_wait(uuid, text) from public, anon, authenticated;

-- invite-member records each try, sent or failed (p_error null = sent).
create function public.record_invite_email(p_gym_id uuid, p_email text, p_error text)
returns void
language sql security definer set search_path = '' as $$
  update public.gym_invites i
    set email_tried_at = now(),
        email_error = left(p_error, 300),
        email_sends = case when i.email_sends_on = current_date then i.email_sends + 1 else 1 end,
        email_sends_on = current_date
    where i.gym_id = p_gym_id and i.email = lower(trim(p_email))
$$;
revoke execute on function public.record_invite_email(uuid, text, text) from public, anon, authenticated;

-- An earlier invite email made an unconfirmed account; Supabase sends it again but keeps
-- its old details (gym, role), so invite-member updates them first. Unconfirmed only.
create function public.invite_account_id(p_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select u.id from auth.users u
  where lower(u.email) = lower(trim(p_email)) and u.email_confirmed_at is null
  limit 1
$$;
revoke execute on function public.invite_account_id(text) from public, anon, authenticated;

-- Admin: one gym per owner invite ------------------------------------------------------
--
-- When the first owner invite didn't arrive, inviting the owner again made a second gym
-- (2026-11-11: "Venkat GYM" and "Venkat GYm"). Now that the invite can be resent from the
-- branch, a second gym for an email whose owner invite is still pending is refused.
create or replace function public.admin_create_owner_gym(
  p_name text, p_city text, p_email text, p_phone text default null
) returns table (gym_id uuid, result text, code text)
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_pending text;
  v_brand_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Only CoreFit Gym admins can set up a gym';
  end if;
  if length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'Enter the gym''s name';
  end if;
  if v_email not like '%_@_%' then
    raise exception 'Enter a valid email address';
  end if;
  if v_email = (select lower(email) from auth.users where id = auth.uid()) then
    raise exception 'Invite the gym owner''s email, not yours';
  end if;
  -- The same owner, by email or by the mobile login of a WhatsApp invite.
  select g.name into v_pending
  from public.gym_invites i
  join public.gyms g on g.id = i.gym_id
  where i.role = 'owner'
    and (
      i.email = v_email
      or (p_phone is not null and i.phone = regexp_replace(
        regexp_replace(p_phone, '[\s()-]', '', 'g'), '^(\+91|0)([6-9][0-9]{9})$', '\2'
      ))
    )
    and not exists (
      select 1 from public.gym_members gm
      where gm.gym_id = i.gym_id and gm.role = 'owner' and gm.status = 'active'
    )
  limit 1;
  if v_pending is not null then
    raise exception 'Already invited to %. Resend it from that branch.', v_pending;
  end if;

  insert into public.brands (name) values (v_name) returning id into v_brand_id;
  insert into public.gyms (name, city, created_by, brand_id)
  values (v_name, trim(coalesce(p_city, '')), auth.uid(), v_brand_id)
  returning id into gym_id;

  if p_phone is null then
    result := public.invite_to_gym(gym_id, v_email, 'owner');
    code := null;
  else
    select w.result, w.code into result, code from public.whatsapp_invite(gym_id, v_email, 'owner', p_phone) w;
  end if;

  -- Their gym is ready, so an older "set up your gym" invite has nothing left to do.
  delete from public.gym_setup_invites where email = v_email;
  return next;
end;
$$;

-- Admin: delete a gym nobody joined ------------------------------------------------------
--
-- For a gym set up by mistake or twice. Only while nobody is at it (no owner, staff or
-- member has joined) and no money came in online; everything of the gym goes with it
-- (all its tables cascade), and its brand too when that was its only branch.
create function public.admin_delete_gym(p_gym_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_brand_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Only CoreFit admins can delete a gym';
  end if;
  select g.brand_id into v_brand_id from public.gyms g where g.id = p_gym_id for update;
  if not found then
    raise exception 'That gym doesn''t exist';
  end if;
  if exists (select 1 from public.gym_members gm where gm.gym_id = p_gym_id) then
    raise exception 'People have joined this gym, so it can''t be deleted';
  end if;
  if exists (
    select 1 from public.online_payments op where op.gym_id = p_gym_id and op.status = 'paid'
  ) or exists (
    select 1 from public.subscription_payments sp
    where sp.gym_id = p_gym_id and sp.method = 'online' and sp.status = 'paid'
  ) then
    raise exception 'This gym has online payments, so it can''t be deleted';
  end if;

  delete from public.gyms g where g.id = p_gym_id;
  delete from public.brands b
    where b.id = v_brand_id and not exists (select 1 from public.gyms g where g.brand_id = b.id);
end;
$$;
revoke execute on function public.admin_delete_gym(uuid) from public, anon;
grant execute on function public.admin_delete_gym(uuid) to authenticated;
