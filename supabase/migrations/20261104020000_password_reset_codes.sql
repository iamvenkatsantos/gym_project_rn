-- Password reset codes for mobile sign-ins.
--
-- People invited on WhatsApp without an email sign in with their mobile number,
-- and their account has no inbox for a reset email. Instead the gym's owner or
-- supervisor makes a one-time reset code on the person screen and sends it on
-- WhatsApp; the person enters it with a new password, and the reset-password
-- edge function sets it. Codes work once and for a day. Only mobile sign-ins
-- get them: anyone with a real email resets by email, so a manager can't take
-- over an email account this way.

create table public.password_reset_codes (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  gym_id uuid not null references public.gyms (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null default now() + interval '1 day'
);

-- Nobody reads or writes it directly: create_password_reset_code() and the
-- reset-password edge function (service role) do.
alter table public.password_reset_codes enable row level security;
revoke all on public.password_reset_codes from anon, authenticated;

create function public.create_password_reset_code(p_gym_id uuid, p_user_id uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
  v_role text;
  v_code text;
begin
  if not public.can_manage_gym(p_gym_id) and not public.is_platform_admin() then
    raise exception 'Only owners and supervisors can reset passwords';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Change your own password from Account';
  end if;
  select gm.role into v_role from public.gym_members gm
    where gm.gym_id = p_gym_id and gm.user_id = p_user_id and gm.status = 'active';
  if v_role is null then
    raise exception 'They aren''t at this gym';
  end if;
  if v_role = 'owner' and not public.has_gym_role(p_gym_id, array['owner'])
     and not public.is_platform_admin() then
    raise exception 'Only owners can reset an owner''s password';
  end if;
  select u.email into v_email from auth.users u
    where u.id = p_user_id and u.email_confirmed_at is not null;
  if v_email is null then
    raise exception 'They haven''t signed up yet. Send their invite again.';
  end if;
  if lower(v_email) not like '%@m.vinven.net' then
    raise exception 'They sign in with email. Ask them to tap Forgot password.';
  end if;

  delete from public.password_reset_codes where user_id = p_user_id;
  loop
    v_code := public.new_invite_code();
    exit when not exists (select 1 from public.password_reset_codes where code = v_code);
  end loop;
  insert into public.password_reset_codes (code, user_id, gym_id, created_by)
    values (v_code, p_user_id, p_gym_id, auth.uid());
  return v_code;
end;
$$;

revoke execute on function public.create_password_reset_code(uuid, uuid) from public, anon;
grant execute on function public.create_password_reset_code(uuid, uuid) to authenticated;

-- For reset-password (service role only): the account behind an unexpired code.
create function public.reset_code_account(p_code text)
returns table (user_id uuid, email text)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email::text
  from public.password_reset_codes r
  join auth.users u on u.id = r.user_id
  where r.code = public.normalize_invite_code(p_code) and r.expires_at > now()
$$;

revoke execute on function public.reset_code_account(text) from public, anon, authenticated;
