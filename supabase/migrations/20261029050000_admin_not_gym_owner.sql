-- The platform admin runs CoreFit Gym, not a gym. After a data wipe the admin has no gym
-- and must still be able to onboard owners, so new gym owners are invited straight from the
-- admin area (invite_gym_owner already needs no gym). Setting up a gym is only for people
-- the admin invited: the admin no longer gets "Set up another gym" for themself.

create or replace function public.can_set_up_gym() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.gym_setup_invites i
    join auth.users u on lower(u.email) = i.email
    where u.id = auth.uid() and u.email_confirmed_at is not null
  )
$$;

create or replace function public.invite_gym_owner(p_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
begin
  if not public.is_platform_admin() then
    raise exception 'Only CoreFit Gym admins can invite a new gym owner';
  end if;
  if v_email not like '%_@_%' then
    raise exception 'Enter a valid email address';
  end if;
  if v_email = (select lower(email) from auth.users where id = auth.uid()) then
    raise exception 'Invite the gym owner''s email, not yours';
  end if;

  insert into public.gym_setup_invites (email, invited_by)
  values (v_email, auth.uid())
  on conflict (email) do update set invited_by = excluded.invited_by, created_at = now();

  return case
    when exists (
      select 1 from auth.users where lower(email) = v_email and email_confirmed_at is not null
    ) then 'added'
    else 'invited'
  end;
end;
$$;
