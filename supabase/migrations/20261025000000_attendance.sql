-- Daily attendance for members and trainers.
--
-- One row per person per gym day (the gym's own time zone). Members and
-- trainers tap Check in when they arrive and Check out when they leave. A
-- member has to be checked in to start a workout, and their mapped trainers
-- get a push when it starts and when it ends. Owners and supervisors read
-- everyone's attendance; others read their own.

create table public.attendance (
  gym_id uuid not null references public.gyms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  role text not null check (role in ('member', 'trainer')),
  checked_in_at timestamptz not null,
  checked_out_at timestamptz,
  -- Finished workouts that day (members only).
  workouts int not null default 0 check (workouts >= 0),
  primary key (gym_id, user_id, day),
  check (checked_out_at is null or checked_out_at >= checked_in_at)
);

create index on public.attendance (gym_id, day);

alter table public.attendance enable row level security;

-- Writes go through the functions and trigger below.
create policy "Read attendance" on public.attendance
  for select using (user_id = auth.uid() or public.can_manage_gym(gym_id));

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('message', 'trainer_request', 'trainer_assigned', 'reminder', 'booking', 'membership',
                  'attendance'));

-- The gym's calendar day at a moment.
create function public.gym_day(p_gym_id uuid, p_at timestamptz default now()) returns date
language sql stable security definer set search_path = '' as $$
  select (p_at at time zone g.time_zone)::date from public.gyms g where g.id = p_gym_id
$$;

revoke execute on function public.gym_day(uuid, timestamptz) from public, anon;
grant execute on function public.gym_day(uuid, timestamptz) to authenticated;

-- Tells the member's active mapped trainers about their workout, once per key.
create function public.tell_member_trainers(
  p_gym_id uuid, p_member_id uuid, p_title text, p_body text, p_dedupe_key text
) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (gym_id, recipient_id, sender_id, kind, title, body, dedupe_key)
  select p_gym_id, mt.trainer_id, p_member_id, 'attendance', left(p_title, 80), left(p_body, 500), p_dedupe_key
  from public.member_trainers mt
  join public.gym_members gm
    on gm.gym_id = mt.gym_id and gm.user_id = mt.trainer_id and gm.role = 'trainer' and gm.status = 'active'
  where mt.gym_id = p_gym_id and mt.member_id = p_member_id
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing
$$;

revoke execute on function public.tell_member_trainers(uuid, uuid, text, text, text) from public, anon, authenticated;

-- Members ----------------------------------------------------------------------------

-- Called by the app when a member starts a workout; refuses until they've
-- checked in today. p_client_id is the workout draft's id, so a retry never
-- pushes twice. Other roles train without being counted, so for them this
-- does nothing.
create function public.start_workout_attendance(p_gym_id uuid, p_client_id uuid, p_title text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  if not public.has_gym_role(p_gym_id, array['member']) then
    return;
  end if;
  if not exists (
    select 1 from public.attendance
    where gym_id = p_gym_id and user_id = auth.uid() and day = public.gym_day(p_gym_id)
      and checked_out_at is null
  ) then
    raise exception 'Check in first';
  end if;

  select full_name into v_name from public.profiles where id = auth.uid();
  perform public.tell_member_trainers(p_gym_id, auth.uid(),
    coalesce(v_name, 'Your member') || ' started a workout',
    coalesce(nullif(trim(p_title), ''), 'A workout') || ' started at '
      || public.gym_time(p_gym_id, now(), 'FMHH12:MI AM') || '.',
    'workout-start:' || p_client_id);
end;
$$;

revoke execute on function public.start_workout_attendance(uuid, uuid, text) from public, anon;
grant execute on function public.start_workout_attendance(uuid, uuid, text) to authenticated;

-- A finished workout counts for the day it started, even if it was uploaded
-- later from an offline phone. Should that day have no check-in (say it was
-- made in demo data or by SQL), the workout's own times stand in for one.
create function public.record_workout_attendance() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
  v_minutes int := greatest(1, round(extract(epoch from new.completed_at - new.started_at) / 60));
begin
  if not exists (
    select 1 from public.gym_members
    where gym_id = new.gym_id and user_id = new.member_id and role = 'member' and status = 'active'
  ) then
    return new;
  end if;
  insert into public.attendance (gym_id, user_id, day, role, checked_in_at, checked_out_at, workouts)
  values (new.gym_id, new.member_id, public.gym_day(new.gym_id, new.started_at), 'member',
          new.started_at, new.completed_at, 1)
  on conflict (gym_id, user_id, day) do update
    set workouts = attendance.workouts + 1;

  -- Only worth a push while it's news.
  if new.completed_at > now() - interval '12 hours' then
    select full_name into v_name from public.profiles where id = new.member_id;
    perform public.tell_member_trainers(new.gym_id, new.member_id,
      coalesce(v_name, 'Your member') || ' finished a workout',
      new.title || ' done at ' || public.gym_time(new.gym_id, new.completed_at, 'FMHH12:MI AM')
        || ' (' || v_minutes || ' min).',
      'workout-end:' || new.client_id);
  end if;
  return new;
end;
$$;

create trigger workout_logs_attendance
  after insert on public.workout_logs
  for each row execute function public.record_workout_attendance();

-- Checking in and out ----------------------------------------------------------------

-- Members and trainers check themselves in. Checking in again after checking out (back from a break) reopens the day and
-- keeps the first check-in time.
create function public.check_in(p_gym_id uuid) returns public.attendance
language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_row public.attendance;
begin
  select role into v_role from public.gym_members
  where gym_id = p_gym_id and user_id = auth.uid() and status = 'active' and role in ('member', 'trainer');
  if v_role is null then
    raise exception 'Only members and trainers check in';
  end if;
  insert into public.attendance (gym_id, user_id, day, role, checked_in_at)
  values (p_gym_id, auth.uid(), public.gym_day(p_gym_id), v_role, now())
  on conflict (gym_id, user_id, day) do update set checked_out_at = null
  returning * into v_row;
  return v_row;
end;
$$;

create function public.check_out(p_gym_id uuid) returns public.attendance
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.attendance;
begin
  update public.attendance set checked_out_at = now()
  where gym_id = p_gym_id and user_id = auth.uid() and day = public.gym_day(p_gym_id)
    and checked_out_at is null
  returning * into v_row;
  if v_row is null then
    raise exception 'Check in first';
  end if;
  return v_row;
end;
$$;

revoke execute on function public.check_in(uuid) from public, anon;
grant execute on function public.check_in(uuid) to authenticated;
revoke execute on function public.check_out(uuid) from public, anon;
grant execute on function public.check_out(uuid) to authenticated;

-- Reading ----------------------------------------------------------------------------

-- The caller's attendance today, if they've checked in.
create function public.my_attendance(p_gym_id uuid) returns setof public.attendance
language sql stable security definer set search_path = '' as $$
  select * from public.attendance
  where gym_id = p_gym_id and user_id = auth.uid() and day = public.gym_day(p_gym_id)
$$;

revoke execute on function public.my_attendance(uuid) from public, anon;
grant execute on function public.my_attendance(uuid) to authenticated;

-- A day's attendance for owners and supervisors: every active trainer and
-- member, with null check-in times for those who didn't come. p_days_ago
-- counts back from today in the gym's time zone.
create function public.gym_attendance(p_gym_id uuid, p_days_ago int default 0)
returns table (
  day date, user_id uuid, full_name text, role text,
  checked_in_at timestamptz, checked_out_at timestamptz, workouts int
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_day date := public.gym_day(p_gym_id) - greatest(p_days_ago, 0);
begin
  if not public.can_manage_gym(p_gym_id) then
    raise exception 'Only owners and supervisors see attendance';
  end if;
  return query
    select v_day, gm.user_id, p.full_name, gm.role,
           a.checked_in_at, a.checked_out_at, coalesce(a.workouts, 0)
    from public.gym_members gm
    join public.profiles p on p.id = gm.user_id
    left join public.attendance a
      on a.gym_id = gm.gym_id and a.user_id = gm.user_id and a.day = v_day
    where gm.gym_id = p_gym_id and gm.status = 'active' and gm.role in ('member', 'trainer')
    order by gm.role desc, a.checked_in_at nulls last, p.full_name;
end;
$$;

revoke execute on function public.gym_attendance(uuid, int) from public, anon;
grant execute on function public.gym_attendance(uuid, int) to authenticated;

-- The attendance report for owners and supervisors: per active trainer and
-- member over the last p_days gym days (today included), how many days they
-- came, their time in the gym on days they checked out, and their workouts.
create function public.attendance_report(p_gym_id uuid, p_days int default 7)
returns table (
  user_id uuid, full_name text, role text,
  days_present int, minutes_in_gym int, workouts int, last_seen date
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := public.gym_day(p_gym_id);
begin
  if not public.can_manage_gym(p_gym_id) then
    raise exception 'Only owners and supervisors see attendance';
  end if;
  if p_days not between 1 and 366 then
    raise exception 'Pick between 1 and 366 days';
  end if;
  return query
    select gm.user_id, p.full_name, gm.role,
           count(a.day)::int,
           coalesce(round(sum(extract(epoch from a.checked_out_at - a.checked_in_at)) / 60), 0)::int,
           coalesce(sum(a.workouts), 0)::int,
           max(a.day)
    from public.gym_members gm
    join public.profiles p on p.id = gm.user_id
    left join public.attendance a
      on a.gym_id = gm.gym_id and a.user_id = gm.user_id
      and a.day between v_today - (p_days - 1) and v_today
    where gm.gym_id = p_gym_id and gm.status = 'active' and gm.role in ('member', 'trainer')
    group by gm.user_id, p.full_name, gm.role
    order by gm.role desc, count(a.day) desc, p.full_name;
end;
$$;

revoke execute on function public.attendance_report(uuid, int) from public, anon;
grant execute on function public.attendance_report(uuid, int) to authenticated;
