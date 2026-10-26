-- Platform admins: the people who run CoreFit Gym itself, not any one gym.
-- Only they can invite a new gym's owner or make anyone an owner, so a gym's
-- owner can't hand out gyms or owner access. Owners still invite and manage
-- members, trainers and supervisors at their own gym.
--
-- Nobody becomes an admin from the app. Add one in the SQL editor:
--   insert into public.platform_admins (user_id)
--   select id from auth.users where email = 'you@example.com';

create table public.platform_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

create policy "Admins see that they are admins" on public.platform_admins
  for select using (user_id = auth.uid());

revoke insert, update, delete on public.platform_admins from authenticated, anon;

create function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

-- Admins, and people an admin invited to set up a gym. Owners no longer can.
create or replace function public.can_set_up_gym() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_platform_admin() or exists (
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

-- Owners invite members, trainers and supervisors; only admins invite owners.
create or replace function public.invite_to_gym(p_gym_id uuid, p_email text, p_role text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
  v_user_id uuid;
begin
  if not public.can_manage_gym(p_gym_id) and not public.is_platform_admin() then
    raise exception 'Only owners and supervisors can invite people';
  end if;
  if p_role not in ('member', 'trainer', 'supervisor', 'owner') then
    raise exception 'Unknown role';
  end if;
  if p_role = 'owner' and not public.is_platform_admin() then
    raise exception 'Only CoreFit Gym admins can add an owner';
  end if;
  if p_role = 'supervisor' and not public.has_gym_role(p_gym_id, array['owner'])
     and not public.is_platform_admin() then
    raise exception 'Only owners can invite supervisors and owners';
  end if;
  if v_email not like '%_@_%' then
    raise exception 'Enter a valid email address';
  end if;

  select id into v_user_id from auth.users
    where lower(email) = v_email and email_confirmed_at is not null;

  if v_user_id is not null then
    insert into public.gym_members (gym_id, user_id, role)
    values (p_gym_id, v_user_id, p_role)
    on conflict (gym_id, user_id) do nothing;
    return case when found then 'added' else 'already_member' end;
  end if;

  insert into public.gym_invites (gym_id, email, role, invited_by)
  values (p_gym_id, v_email, p_role, auth.uid())
  on conflict (gym_id, email) do update set role = excluded.role, invited_by = excluded.invited_by;
  return 'invited';
end;
$$;

-- Owners can't make someone an owner from the People screen either. Inserts by
-- create_gym() and invite claims run as the gym's new owner or with no user, so
-- only role changes made by a signed-in non-admin are checked.
create function public.only_admins_make_owners() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'owner' and old.role <> 'owner'
     and auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'Only CoreFit Gym admins can make someone an owner';
  end if;
  return new;
end;
$$;

create trigger gym_members_only_admins_make_owners
  before update of role on public.gym_members
  for each row execute function public.only_admins_make_owners();
