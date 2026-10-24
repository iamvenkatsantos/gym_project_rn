-- Core schema for the gym app: gyms, profiles (roles), workouts, classes,
-- bookings and memberships. Every table is scoped to a gym through RLS.

create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  gym_id uuid references public.gyms (id) on delete set null,
  full_name text not null default '',
  role text not null default 'member' check (role in ('member', 'trainer', 'owner')),
  created_at timestamptz not null default now()
);

-- Helpers used by policies. Security definer so they can read profiles
-- without recursing through the profiles policies.
create function public.current_gym_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select gym_id from public.profiles where id = auth.uid()
$$;

create function public.current_role_is(wanted text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = wanted)
$$;

-- New sign-ups become members with no gym; an owner assigns the gym and role.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null default '',
  level text not null default 'beginner' check (level in ('beginner', 'intermediate', 'advanced')),
  duration_minutes int not null check (duration_minutes > 0),
  exercises jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  -- Nulled rather than cascaded so deleting a trainer's account keeps the timetable.
  trainer_id uuid references public.profiles (id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  duration_minutes int not null check (duration_minutes > 0),
  capacity int not null check (capacity > 0),
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'booked' check (status in ('booked', 'cancelled', 'attended')),
  created_at timestamptz not null default now(),
  unique (class_id, member_id)
);

create table public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  name text not null,
  price_cents int not null check (price_cents >= 0),
  currency text not null default 'INR',
  duration_days int not null check (duration_days > 0),
  active boolean not null default true
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid not null references public.membership_plans (id),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create index on public.classes (gym_id, starts_at);
create index on public.bookings (member_id);
create index on public.memberships (member_id, ends_on desc);

-- Classes with trainer name and live booked count. Runs as the view owner so
-- members see accurate counts without seeing other members' bookings; the
-- where clause keeps it scoped to the caller's gym.
create view public.class_schedule as
  select
    c.id, c.gym_id, c.trainer_id, coalesce(p.full_name, 'TBA') as trainer_name, c.title, c.starts_at,
    c.duration_minutes, c.capacity,
    (select count(*)::int from public.bookings b
      where b.class_id = c.id and b.status = 'booked') as booked_count
  from public.classes c
  left join public.profiles p on p.id = c.trainer_id
  where c.gym_id = public.current_gym_id();

-- Books the caller into a class, locking the class row so two members can't
-- take the last spot at the same time. Re-booking a cancelled spot reuses it.
create function public.book_class(p_class_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_class public.classes;
  v_booked int;
  v_id uuid;
begin
  select * into v_class from public.classes where id = p_class_id for update;
  if not found or v_class.gym_id is distinct from public.current_gym_id() then
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

-- Row-level security ---------------------------------------------------------

alter table public.gyms enable row level security;
alter table public.profiles enable row level security;
alter table public.workouts enable row level security;
alter table public.classes enable row level security;
alter table public.bookings enable row level security;
alter table public.membership_plans enable row level security;
alter table public.memberships enable row level security;

create policy "Read own gym" on public.gyms
  for select using (id = public.current_gym_id());

create policy "Read profiles in own gym" on public.profiles
  for select using (id = auth.uid() or gym_id = public.current_gym_id());
create policy "Owners manage profiles in their gym" on public.profiles
  for update using (public.current_role_is('owner') and gym_id = public.current_gym_id())
  with check (gym_id = public.current_gym_id());

create policy "Read workouts in own gym" on public.workouts
  for select using (gym_id = public.current_gym_id());
create policy "Trainers manage their workouts" on public.workouts
  for all using (public.current_role_is('trainer') and trainer_id = auth.uid())
  with check (
    public.current_role_is('trainer') and trainer_id = auth.uid()
    and gym_id = public.current_gym_id()
  );
create policy "Owners manage workouts in their gym" on public.workouts
  for all using (public.current_role_is('owner') and gym_id = public.current_gym_id())
  with check (gym_id = public.current_gym_id());

create policy "Read classes in own gym" on public.classes
  for select using (gym_id = public.current_gym_id());
create policy "Owners manage classes" on public.classes
  for all using (public.current_role_is('owner') and gym_id = public.current_gym_id())
  with check (gym_id = public.current_gym_id());

-- Inserts go through book_class(); members can only cancel their own.
create policy "Members read own bookings" on public.bookings
  for select using (member_id = auth.uid());
create policy "Staff read bookings in their gym" on public.bookings
  for select using (
    (public.current_role_is('trainer') or public.current_role_is('owner'))
    and exists (select 1 from public.classes c
      where c.id = class_id and c.gym_id = public.current_gym_id())
  );
create policy "Members cancel own bookings" on public.bookings
  for update using (member_id = auth.uid())
  with check (member_id = auth.uid() and status = 'cancelled');

create policy "Read plans in own gym" on public.membership_plans
  for select using (gym_id = public.current_gym_id());
create policy "Owners manage plans" on public.membership_plans
  for all using (public.current_role_is('owner') and gym_id = public.current_gym_id())
  with check (gym_id = public.current_gym_id());

create policy "Members read own memberships" on public.memberships
  for select using (member_id = auth.uid());
create policy "Owners manage memberships in their gym" on public.memberships
  for all using (
    public.current_role_is('owner')
    and exists (select 1 from public.membership_plans mp
      where mp.id = plan_id and mp.gym_id = public.current_gym_id())
  )
  with check (
    exists (select 1 from public.membership_plans mp
      where mp.id = plan_id and mp.gym_id = public.current_gym_id())
  );

revoke execute on function public.book_class(uuid) from public, anon;
grant execute on function public.book_class(uuid) to authenticated;
