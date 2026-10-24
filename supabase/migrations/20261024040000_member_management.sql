-- Member management: owners invite people by email, change roles and suspend
-- or remove access. A gym always keeps at least one active owner.

create table public.gym_invites (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  email text not null check (email = lower(trim(email)) and email like '%_@_%'),
  role text not null default 'member' check (role in ('member', 'trainer', 'owner')),
  invited_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (gym_id, email)
);

alter table public.gym_invites enable row level security;

-- Writes go through invite_to_gym(); owners can see and withdraw pending invites.
create policy "Owners read invites" on public.gym_invites
  for select using (public.has_gym_role(gym_id, array['owner']));
create policy "Owners withdraw invites" on public.gym_invites
  for delete using (public.has_gym_role(gym_id, array['owner']));

-- Adds someone who already has a confirmed account straight away; otherwise
-- keeps an invite that's claimed when they confirm an account with that email.
-- Returns 'added', 'invited' or 'already_member'.
create function public.invite_to_gym(p_gym_id uuid, p_email text, p_role text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
  v_user_id uuid;
begin
  if not public.has_gym_role(p_gym_id, array['owner']) then
    raise exception 'Only owners can invite people';
  end if;
  if v_email not like '%_@_%' then
    raise exception 'Enter a valid email address';
  end if;
  if p_role not in ('member', 'trainer', 'owner') then
    raise exception 'Unknown role';
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

revoke execute on function public.invite_to_gym(uuid, text, text) from public, anon;
grant execute on function public.invite_to_gym(uuid, text, text) to authenticated;

-- Turns pending invites into gym memberships once the email is confirmed, so
-- nobody can claim an invite with an address they don't own.
create function public.claim_gym_invites() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is null or new.email is null then
    return new;
  end if;
  insert into public.gym_members (gym_id, user_id, role)
    select gym_id, new.id, role from public.gym_invites where email = lower(new.email)
    on conflict (gym_id, user_id) do nothing;
  delete from public.gym_invites where email = lower(new.email);
  return new;
end;
$$;

-- Runs after on_auth_user_created (trigger names fire alphabetically), so the profile exists.
create trigger on_auth_user_email_confirmed
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.claim_gym_invites();

-- Everyone at a gym with their email, for the owner's People screen.
create function public.gym_people(p_gym_id uuid)
returns table (
  user_id uuid, full_name text, email text, role text, status text, joined_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select gm.user_id, p.full_name, u.email::text, gm.role, gm.status, gm.joined_at
  from public.gym_members gm
  join public.profiles p on p.id = gm.user_id
  join auth.users u on u.id = gm.user_id
  where gm.gym_id = p_gym_id and public.has_gym_role(p_gym_id, array['owner'])
  order by p.full_name
$$;

revoke execute on function public.gym_people(uuid) from public, anon;
grant execute on function public.gym_people(uuid) to authenticated;

-- A gym must keep an active owner, so the last one can't demote, suspend or
-- remove themselves. Deleting the gym or the owner's whole account still works.
create function public.keep_an_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role <> 'owner' or old.status <> 'active' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.role = 'owner' and new.status = 'active' then
    return new;
  end if;
  if tg_op = 'DELETE' and (
    not exists (select 1 from public.gyms where id = old.gym_id)
    or not exists (select 1 from public.profiles where id = old.user_id)
  ) then
    return old;
  end if;
  if not exists (
    select 1 from public.gym_members
    where gym_id = old.gym_id and user_id <> old.user_id and role = 'owner' and status = 'active'
  ) then
    raise exception 'A gym needs at least one active owner';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger gym_members_keep_an_owner
  before update or delete on public.gym_members
  for each row execute function public.keep_an_owner();
