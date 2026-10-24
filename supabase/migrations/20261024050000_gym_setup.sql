-- Gym setup for owners: membership plans, a class timetable with weekly
-- repeats and cancellations, and memberships recorded with offline payments.

-- Plans ---------------------------------------------------------------------------

alter table public.membership_plans
  add constraint membership_plans_name_present check (length(trim(name)) > 0),
  add constraint membership_plans_duration_range check (duration_days between 1 and 3660);

-- Memberships ---------------------------------------------------------------------

alter table public.memberships
  add column amount_paid_cents int check (amount_paid_cents >= 0),
  add column payment_method text check (
    payment_method in ('cash', 'upi', 'card', 'bank_transfer', 'online', 'complimentary')
  ),
  add column note text not null default '',
  add column recorded_by uuid references public.profiles (id) on delete set null default auth.uid();

-- Owners may only record memberships for people who belong to the plan's gym.
drop policy "Owners manage memberships" on public.memberships;
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
      join public.gym_members gm on gm.gym_id = mp.gym_id and gm.user_id = member_id
      where mp.id = plan_id and public.has_gym_role(mp.gym_id, array['owner'])
    )
  );

-- Classes -------------------------------------------------------------------------

alter table public.classes
  add column series_id uuid,
  add column status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  add constraint classes_title_present check (length(trim(title)) > 0),
  add constraint classes_duration_range check (duration_minutes between 5 and 600),
  add constraint classes_capacity_range check (capacity between 1 and 500);

create index on public.classes (series_id);

-- A class's trainer must be a trainer at that gym.
create function public.check_class_trainer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.trainer_id is not null and not exists (
    select 1 from public.gym_members
    where gym_id = new.gym_id and user_id = new.trainer_id and role = 'trainer' and status = 'active'
  ) then
    raise exception 'Pick a trainer from this gym';
  end if;
  if tg_op = 'UPDATE' and new.capacity < old.capacity and new.capacity < (
    select count(*) from public.bookings where class_id = new.id and status = 'booked'
  ) then
    raise exception 'More people have booked than the new capacity';
  end if;
  return new;
end;
$$;

create trigger classes_check_trainer
  before insert or update on public.classes
  for each row execute function public.check_class_trainer();

-- Cancelled classes drop off the timetable; their bookings are cancelled with them.
create or replace view public.class_schedule as
  select
    c.id, c.gym_id, c.trainer_id, coalesce(p.full_name, 'TBA') as trainer_name, c.title,
    c.starts_at, c.duration_minutes, c.capacity,
    (select count(*)::int from public.bookings b
      where b.class_id = c.id and b.status = 'booked') as booked_count,
    c.series_id
  from public.classes c
  left join public.profiles p on p.id = c.trainer_id
  where public.is_gym_member(c.gym_id) and c.status = 'scheduled';

-- Booking refuses cancelled classes.
create or replace function public.book_class(p_class_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_class public.classes;
  v_booked int;
  v_id uuid;
begin
  select * into v_class from public.classes where id = p_class_id for update;
  if not found or not public.is_gym_member(v_class.gym_id) or v_class.status <> 'scheduled' then
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

-- Schedules a class, repeated weekly for p_weeks weeks at the same local time
-- in the gym's time zone. Runs as the caller, so only owners can insert.
create function public.schedule_classes(
  p_gym_id uuid,
  p_title text,
  p_trainer_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes int,
  p_capacity int,
  p_weeks int
) returns int
language plpgsql security invoker set search_path = '' as $$
declare
  v_tz text;
  v_local timestamp;
  v_series uuid := case when p_weeks > 1 then gen_random_uuid() end;
begin
  if p_weeks not between 1 and 26 then
    raise exception 'Repeat for 1 to 26 weeks';
  end if;
  if p_starts_at <= now() then
    raise exception 'Pick a time in the future';
  end if;
  select time_zone into v_tz from public.gyms where id = p_gym_id;
  v_local := p_starts_at at time zone v_tz;

  insert into public.classes
    (gym_id, trainer_id, title, starts_at, duration_minutes, capacity, series_id)
  select p_gym_id, p_trainer_id, trim(p_title),
         (v_local + make_interval(weeks => w)) at time zone v_tz,
         p_duration_minutes, p_capacity, v_series
  from generate_series(0, p_weeks - 1) as w;

  return p_weeks;
end;
$$;

revoke execute on function public.schedule_classes(uuid, text, uuid, timestamptz, int, int, int) from public, anon;
grant execute on function public.schedule_classes(uuid, text, uuid, timestamptz, int, int, int) to authenticated;

-- Cancels a class, or it and the rest of its series, and the bookings on them.
-- Returns how many classes were cancelled. Security definer because owners
-- can't otherwise update members' bookings; the owner check comes first.
create function public.cancel_class(p_class_id uuid, p_rest_of_series boolean)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_class public.classes;
  v_ids uuid[];
begin
  select * into v_class from public.classes where id = p_class_id;
  if not found or not public.has_gym_role(v_class.gym_id, array['owner']) then
    raise exception 'Class not found';
  end if;

  select array_agg(id) into v_ids from public.classes
    where status = 'scheduled'
      and (
        id = p_class_id
        or (p_rest_of_series and v_class.series_id is not null
            and series_id = v_class.series_id and starts_at >= v_class.starts_at)
      );

  update public.classes set status = 'cancelled' where id = any (v_ids);
  update public.bookings set status = 'cancelled'
    where class_id = any (v_ids) and status = 'booked';
  return coalesce(array_length(v_ids, 1), 0);
end;
$$;

revoke execute on function public.cancel_class(uuid, boolean) from public, anon;
grant execute on function public.cancel_class(uuid, boolean) to authenticated;
