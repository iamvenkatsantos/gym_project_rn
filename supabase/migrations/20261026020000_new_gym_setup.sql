-- New gyms. Inviting someone as an owner used to make them a co-owner of the
-- inviter's gym, so a new gym's owner saw every member and trainer there.
-- Now an owner can invite someone to set up a gym of their own: after signing
-- in they enter the gym's details, a new gym is created with them as its only
-- owner, and every list they see is scoped to that gym by the existing RLS.
-- Owners can also set up another gym themselves, say a second branch.

alter table public.gyms
  add column address text not null default '' check (length(address) <= 200),
  add column city text not null default '' check (length(city) <= 60),
  add column phone text not null default '' check (length(phone) <= 20),
  add column email text not null default '' check (length(email) <= 254),
  add column created_by uuid references public.profiles (id) on delete set null;

-- People asked to set up a gym of their own, by email. Writes go through
-- invite_gym_owner(); claimed by create_gym().
create table public.gym_setup_invites (
  email text primary key check (email = lower(trim(email)) and email like '%_@_%'),
  invited_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.gym_setup_invites enable row level security;

create policy "Read setup invites you sent" on public.gym_setup_invites
  for select using (invited_by = auth.uid());

-- Owners of any gym, and people an owner invited to set one up.
create function public.can_set_up_gym() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.gym_members
    where user_id = auth.uid() and role = 'owner' and status = 'active'
  ) or exists (
    select 1 from public.gym_setup_invites i
    join auth.users u on lower(u.email) = i.email
    where u.id = auth.uid() and u.email_confirmed_at is not null
  )
$$;

revoke execute on function public.can_set_up_gym() from public, anon;
grant execute on function public.can_set_up_gym() to authenticated;

-- Returns 'added' when they already have a confirmed account (they can set the
-- gym up next time they open the app), otherwise 'invited'.
create function public.invite_gym_owner(p_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
begin
  if not exists (
    select 1 from public.gym_members
    where user_id = auth.uid() and role = 'owner' and status = 'active'
  ) then
    raise exception 'Only gym owners can invite a new gym owner';
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

revoke execute on function public.invite_gym_owner(text) from public, anon;
grant execute on function public.invite_gym_owner(text) to authenticated;

-- Creates a gym with the caller as its only owner and returns its id.
create function public.create_gym(
  p_name text, p_address text, p_city text, p_phone text, p_email text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := trim(p_name);
  v_gym_id uuid;
begin
  if auth.uid() is null or not public.can_set_up_gym() then
    raise exception 'Ask CoreFit Gym for an invite to set up a gym';
  end if;
  if length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'Enter the gym''s name';
  end if;

  insert into public.gyms (name, address, city, phone, email, created_by)
  values (
    v_name, trim(coalesce(p_address, '')), trim(coalesce(p_city, '')),
    trim(coalesce(p_phone, '')), lower(trim(coalesce(p_email, ''))), auth.uid()
  )
  returning id into v_gym_id;

  insert into public.gym_members (gym_id, user_id, role)
  values (v_gym_id, auth.uid(), 'owner');

  delete from public.gym_setup_invites
  where email = (select lower(email) from auth.users where id = auth.uid());

  return v_gym_id;
end;
$$;

revoke execute on function public.create_gym(text, text, text, text, text) from public, anon;
grant execute on function public.create_gym(text, text, text, text, text) to authenticated;

-- Owners edit their gym's details, but not who created it.
revoke update on public.gyms from authenticated;
grant update (name, address, city, phone, email) on public.gyms to authenticated;
