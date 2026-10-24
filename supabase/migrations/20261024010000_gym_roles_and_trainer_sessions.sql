-- Gym-scoped roles and trainer 1:1 sessions.
--
-- A person can belong to several gyms and hold a different role in each, so
-- role and gym move off profiles into gym_members. Every policy now checks
-- membership of the row's own gym instead of a single "current gym".

create extension if not exists btree_gist;

create table public.gym_members (
  gym_id uuid not null references public.gyms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'trainer', 'owner')),
  status text not null default 'active' check (status in ('invited', 'active', 'suspended')),
  joined_at timestamptz not null default now(),
  primary key (gym_id, user_id)
);

create index on public.gym_members (user_id);

insert into public.gym_members (gym_id, user_id, role)
  select gym_id, id, role from public.profiles where gym_id is not null;

-- Helpers ---------------------------------------------------------------------

create function public.is_gym_member(p_gym_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.gym_members
    where gym_id = p_gym_id and user_id = auth.uid() and status = 'active'
  )
$$;

create function public.has_gym_role(p_gym_id uuid, p_roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.gym_members
    where gym_id = p_gym_id and user_id = auth.uid() and status = 'active' and role = any (p_roles)
  )
$$;

-- Drop everything that depended on profiles.gym_id / profiles.role -------------

drop view public.class_schedule;
drop function public.book_class(uuid);

drop policy "Read own gym" on public.gyms;
drop policy "Read profiles in own gym" on public.profiles;
drop policy "Owners manage profiles in their gym" on public.profiles;
drop policy "Read workouts in own gym" on public.workouts;
drop policy "Trainers manage their workouts" on public.workouts;
drop policy "Owners manage workouts in their gym" on public.workouts;
drop policy "Read classes in own gym" on public.classes;
drop policy "Owners manage classes" on public.classes;
drop policy "Staff read bookings in their gym" on public.bookings;
drop policy "Read plans in own gym" on public.membership_plans;
drop policy "Owners manage plans" on public.membership_plans;
drop policy "Owners manage memberships in their gym" on public.memberships;

drop function public.current_gym_id();
drop function public.current_role_is(text);

alter table public.profiles drop column gym_id, drop column role;

-- Policies ----------------------------------------------------------------------

alter table public.gym_members enable row level security;

create policy "Read gyms you belong to" on public.gyms
  for select using (public.is_gym_member(id));
create policy "Owners update their gym" on public.gyms
  for update using (public.has_gym_role(id, array['owner']));

create policy "Read memberships of your gyms" on public.gym_members
  for select using (user_id = auth.uid() or public.is_gym_member(gym_id));
create policy "Owners manage gym members" on public.gym_members
  for all using (public.has_gym_role(gym_id, array['owner']))
  with check (public.has_gym_role(gym_id, array['owner']));

create policy "Read own and gym-mates' profiles" on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from public.gym_members theirs
      where theirs.user_id = profiles.id and public.is_gym_member(theirs.gym_id)
    )
  );
create policy "Update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "Read workouts in your gyms" on public.workouts
  for select using (public.is_gym_member(gym_id));
create policy "Trainers manage their workouts" on public.workouts
  for all using (trainer_id = auth.uid() and public.has_gym_role(gym_id, array['trainer']))
  with check (trainer_id = auth.uid() and public.has_gym_role(gym_id, array['trainer']));
create policy "Owners manage workouts" on public.workouts
  for all using (public.has_gym_role(gym_id, array['owner']))
  with check (public.has_gym_role(gym_id, array['owner']));

create policy "Read classes in your gyms" on public.classes
  for select using (public.is_gym_member(gym_id));
create policy "Owners manage classes" on public.classes
  for all using (public.has_gym_role(gym_id, array['owner']))
  with check (public.has_gym_role(gym_id, array['owner']));

create policy "Staff read class bookings" on public.bookings
  for select using (
    exists (
      select 1 from public.classes c
      where c.id = class_id and public.has_gym_role(c.gym_id, array['trainer', 'owner'])
    )
  );

create policy "Read plans in your gyms" on public.membership_plans
  for select using (public.is_gym_member(gym_id));
create policy "Owners manage plans" on public.membership_plans
  for all using (public.has_gym_role(gym_id, array['owner']))
  with check (public.has_gym_role(gym_id, array['owner']));

create policy "Owners manage memberships" on public.memberships
  for all using (
    exists (
      select 1 from public.membership_plans mp
      where mp.id = plan_id and public.has_gym_role(mp.gym_id, array['owner'])
    )
  )
  with check (
    exists (
      select 1 from public.membership_plans mp
      where mp.id = plan_id and public.has_gym_role(mp.gym_id, array['owner'])
    )
  );

-- Class schedule and booking, now scoped by the class's own gym ------------------

create view public.class_schedule as
  select
    c.id, c.gym_id, c.trainer_id, coalesce(p.full_name, 'TBA') as trainer_name, c.title,
    c.starts_at, c.duration_minutes, c.capacity,
    (select count(*)::int from public.bookings b
      where b.class_id = c.id and b.status = 'booked') as booked_count
  from public.classes c
  left join public.profiles p on p.id = c.trainer_id
  where public.is_gym_member(c.gym_id);

create function public.book_class(p_class_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_class public.classes;
  v_booked int;
  v_id uuid;
begin
  select * into v_class from public.classes where id = p_class_id for update;
  if not found or not public.is_gym_member(v_class.gym_id) then
    raise exception 'Class not found';
  end if;
  if v_class.starts_at <= now() then
    raise exception 'Class has already started';
  end if;

  select count(*) into v_booked from public.bookings
    where class_id = p_class_id and status = 'booked';
  if v_booked >= v_class.capacity then
    raise exception 'Class is full';
  end if;

  insert into public.bookings (class_id, member_id)
  values (p_class_id, auth.uid())
  on conflict (class_id, member_id) do update set status = 'booked'
    where public.bookings.status = 'cancelled'
  returning id into v_id;

  if v_id is null then
    raise exception 'Already booked';
  end if;
  return v_id;
end;
$$;

revoke execute on function public.book_class(uuid) from public, anon;
grant execute on function public.book_class(uuid) to authenticated;

-- Trainers and 1:1 sessions -----------------------------------------------------

create table public.trainer_profiles (
  gym_id uuid not null references public.gyms (id) on delete cascade,
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  bio text not null default '',
  specialties text[] not null default '{}',
  session_minutes int not null default 60 check (session_minutes between 15 and 240),
  primary key (gym_id, trainer_id)
);

-- Weekly recurring availability in the gym's local time.
create table public.trainer_availability (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);

create index on public.trainer_availability (gym_id, trainer_id);

create table public.trainer_sessions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'booked' check (status in ('booked', 'cancelled', 'completed')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- The database itself refuses overlapping booked sessions for a trainer.
  constraint trainer_sessions_no_overlap exclude using gist (
    trainer_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'booked')
);

create index on public.trainer_sessions (member_id, starts_at);
create index on public.trainer_sessions (trainer_id, starts_at);

alter table public.trainer_profiles enable row level security;
alter table public.trainer_availability enable row level security;
alter table public.trainer_sessions enable row level security;

create policy "Read trainers in your gyms" on public.trainer_profiles
  for select using (public.is_gym_member(gym_id));
create policy "Trainers edit their own profile" on public.trainer_profiles
  for all using (trainer_id = auth.uid() and public.has_gym_role(gym_id, array['trainer']))
  with check (trainer_id = auth.uid() and public.has_gym_role(gym_id, array['trainer']));
create policy "Owners manage trainer profiles" on public.trainer_profiles
  for all using (public.has_gym_role(gym_id, array['owner']))
  with check (public.has_gym_role(gym_id, array['owner']));

create policy "Read availability in your gyms" on public.trainer_availability
  for select using (public.is_gym_member(gym_id));
create policy "Trainers manage their availability" on public.trainer_availability
  for all using (trainer_id = auth.uid() and public.has_gym_role(gym_id, array['trainer']))
  with check (trainer_id = auth.uid() and public.has_gym_role(gym_id, array['trainer']));

-- Inserts go through book_trainer_session(). Members only see their own
-- sessions; trainers see theirs; owners see the whole gym.
create policy "Members read own sessions" on public.trainer_sessions
  for select using (member_id = auth.uid());
create policy "Trainers read their sessions" on public.trainer_sessions
  for select using (trainer_id = auth.uid());
create policy "Owners read gym sessions" on public.trainer_sessions
  for select using (public.has_gym_role(gym_id, array['owner']));
create policy "Members cancel own sessions" on public.trainer_sessions
  for update using (member_id = auth.uid() and status = 'booked')
  with check (member_id = auth.uid() and status = 'cancelled');
create policy "Trainers update their sessions" on public.trainer_sessions
  for update using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());

-- Busy times for a trainer, without exposing who booked them.
create function public.trainer_busy_slots(p_trainer_id uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.starts_at, s.ends_at from public.trainer_sessions s
  where s.trainer_id = p_trainer_id
    and s.status = 'booked'
    and s.starts_at < p_to and s.ends_at > p_from
    and public.is_gym_member(s.gym_id)
$$;

-- Books the caller with a trainer. Checks gym membership, the trainer's weekly
-- availability (in the gym's time zone) and lead time; the exclusion
-- constraint catches a concurrent booking of the same slot.
alter table public.gyms add column time_zone text not null default 'Asia/Kolkata';

create function public.book_trainer_session(p_gym_id uuid, p_trainer_id uuid, p_starts_at timestamptz)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_minutes int;
  v_tz text;
  v_local timestamp;
  v_ends_at timestamptz;
  v_id uuid;
begin
  if not public.has_gym_role(p_gym_id, array['member']) then
    raise exception 'Only members of this gym can book trainers';
  end if;
  if p_starts_at <= now() then
    raise exception 'That time has passed';
  end if;

  select tp.session_minutes into v_minutes from public.trainer_profiles tp
    where tp.gym_id = p_gym_id and tp.trainer_id = p_trainer_id;
  if not found then
    raise exception 'Trainer not found';
  end if;

  select g.time_zone into v_tz from public.gyms g where g.id = p_gym_id;
  v_local := p_starts_at at time zone v_tz;
  v_ends_at := p_starts_at + make_interval(mins => v_minutes);

  if not exists (
    select 1 from public.trainer_availability a
    where a.gym_id = p_gym_id and a.trainer_id = p_trainer_id
      and a.weekday = extract(dow from v_local)::int
      and a.start_time <= v_local::time
      and a.end_time >= (v_local + make_interval(mins => v_minutes))::time
  ) then
    raise exception 'Trainer is not available at that time';
  end if;

  begin
    insert into public.trainer_sessions (gym_id, trainer_id, member_id, starts_at, ends_at)
    values (p_gym_id, p_trainer_id, auth.uid(), p_starts_at, v_ends_at)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'That slot was just taken';
  end;
  return v_id;
end;
$$;

revoke execute on function public.book_trainer_session(uuid, uuid, timestamptz) from public, anon;
grant execute on function public.book_trainer_session(uuid, uuid, timestamptz) to authenticated;
revoke execute on function public.trainer_busy_slots(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.trainer_busy_slots(uuid, timestamptz, timestamptz) to authenticated;
