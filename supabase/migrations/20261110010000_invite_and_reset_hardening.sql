-- Closes three ways one gym's staff could reach another gym's accounts
-- (GitHub issues #114, #115, #117).

-- 1. Invite codes for mobile sign-ins (#114) -------------------------------------------
--
-- A WhatsApp code proves only that it reached the phone the inviter typed. For a real
-- email accept-invite now asks for the email's own sign-up code; a mobile sign-in has
-- no inbox, so instead its code is refused when the number is tied to another gym
-- (an invite there, or an unconfirmed account already at one). Otherwise confirming it
-- would claim that other gym's invite too, since claim_gym_invites() claims them all.
create function public.invite_code_conflict(p_code text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.gym_invites i
    join public.gym_invites other on other.email = i.email and other.gym_id <> i.gym_id
    where i.code = public.normalize_invite_code(p_code)
  ) or exists (
    select 1
    from public.gym_invites i
    join auth.users u on lower(u.email) = i.email
    join public.gym_members gm on gm.user_id = u.id and gm.gym_id <> i.gym_id
    where i.code = public.normalize_invite_code(p_code)
  )
$$;

revoke execute on function public.invite_code_conflict(text) from public, anon, authenticated;

-- 2. Password reset codes (#115) --------------------------------------------------------
--
-- The role check used to look only at the caller's gym, so a manager could add someone
-- by mobile number and then reset the password of an account that owns another gym.
-- Now every gym the person is at must be one the caller manages, and only an owner of
-- that gym can reset someone who owns it.
create or replace function public.create_password_reset_code(p_gym_id uuid, p_user_id uuid)
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
  if not public.is_platform_admin() then
    if exists (
      select 1 from public.gym_members gm
      where gm.user_id = p_user_id and gm.gym_id <> p_gym_id
        and not public.can_manage_gym(gm.gym_id)
    ) then
      raise exception 'They''re at another gym too. Ask CoreFit support to reset it.';
    end if;
    if exists (
      select 1 from public.gym_members gm
      where gm.user_id = p_user_id and gm.role = 'owner'
        and not public.has_gym_role(gm.gym_id, array['owner'])
    ) then
      raise exception 'Only owners can reset an owner''s password';
    end if;
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

-- 3. gym_members writes (#117) ----------------------------------------------------------
--
-- Owners could insert any account with any role straight into gym_members, and change a
-- role by deleting and re-inserting the row (the role lock only fires on update). People
-- join only through the invite RPCs and triggers, which run as definer, so the app needs
-- just suspend/reactivate (status) and remove.
drop policy if exists "Owners manage gym members" on public.gym_members;

create policy "Owners suspend or reactivate gym members" on public.gym_members
  for update using (public.has_gym_role(gym_id, array['owner']))
  with check (public.has_gym_role(gym_id, array['owner']));
create policy "Owners remove gym members" on public.gym_members
  for delete using (public.has_gym_role(gym_id, array['owner']));

revoke insert, update on public.gym_members from anon, authenticated;
-- Role stays updatable for platform admins; gym_members_lock_role refuses everyone else.
grant update (status, role) on public.gym_members to authenticated;
