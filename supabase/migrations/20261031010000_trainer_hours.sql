-- Trainer working hours, loss of pay (LOP) and permissions.
--
-- Owners set the hours a trainer must work each day, how far short is
-- allowed, and how many LOP hours a shorter day costs. Trainers never see
-- these rules or their own LOP; only owners do. Trainers ask the owner for
-- permission (a reason and a time range on one day); approved permission
-- counts as time worked.
--
-- Hours worked come from attendance: every visit (check-in to check-out) is
-- added up, so stepping out for a break doesn't count as work but a split
-- shift does. The LOP maths itself lives in the app
-- (src/features/trainer-hours/rules.ts); the server hands over the days.

-- Minutes worked per day ---------------------------------------------------------

alter table public.attendance
  add column worked_minutes int not null default 0 check (worked_minutes >= 0),
  add column longest_visit_minutes int not null default 0 check (longest_visit_minutes >= 0);

-- Days already closed: first check-in to last check-out is the best we have.
update public.attendance
set worked_minutes = greatest(0, round(extract(epoch from checked_out_at - checked_in_at) / 60))::int,
    longest_visit_minutes = greatest(0, round(extract(epoch from checked_out_at - checked_in_at) / 60))::int
where checked_out_at is not null;

-- Each time a visit ends (button, QR, auto check-out), add its minutes.
create function public.count_worked_minutes() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_visit int;
begin
  if tg_op = 'INSERT' then
    if new.checked_out_at is not null then
      v_visit := greatest(0, round(extract(epoch from new.checked_out_at - new.checked_in_at) / 60))::int;
      new.worked_minutes := v_visit;
      new.longest_visit_minutes := v_visit;
    end if;
  elsif old.checked_out_at is null and new.checked_out_at is not null then
    v_visit := greatest(0, round(extract(epoch from
      new.checked_out_at - coalesce(old.last_check_in_at, old.checked_in_at)) / 60))::int;
    new.worked_minutes := old.worked_minutes + v_visit;
    new.longest_visit_minutes := greatest(old.longest_visit_minutes, v_visit);
  end if;
  return new;
end;
$$;

create trigger attendance_worked_minutes
  before insert or update of checked_out_at on public.attendance
  for each row execute function public.count_worked_minutes();

-- Owners' rules, one row per branch ------------------------------------------------

create table public.trainer_hour_rules (
  gym_id uuid primary key references public.gyms (id) on delete cascade,
  required_minutes int not null check (required_minutes between 60 and 16 * 60),
  -- Short by more than this costs LOP; 0 means any shortfall does.
  short_limit_minutes int not null check (short_limit_minutes >= 0),
  lop_minutes int not null check (lop_minutes between 0 and 16 * 60),
  -- Weekly off days, 0 = Sunday … 6 = Saturday. Never LOP.
  off_days smallint[] not null default '{0}'
    check (off_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  -- LOP counts from the day the rules were first saved, never before.
  starts_on date not null,
  updated_at timestamptz not null default now()
);

alter table public.trainer_hour_rules enable row level security;

-- Secret from trainers and supervisors: owners only. Writes go through set_trainer_hour_rules.
create policy "Owners read trainer hour rules" on public.trainer_hour_rules
  for select using (public.has_gym_role(gym_id, array['owner']));

create function public.set_trainer_hour_rules(
  p_gym_id uuid, p_required_minutes int, p_short_limit_minutes int, p_lop_minutes int,
  p_off_days smallint[]
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_gym_role(p_gym_id, array['owner']) then
    raise exception 'Only owners set working hours';
  end if;
  if p_short_limit_minutes >= p_required_minutes then
    raise exception 'The allowed shortfall must be less than the working hours';
  end if;
  if cardinality(coalesce(p_off_days, '{}')) >= 7 then
    raise exception 'Leave at least one working day';
  end if;
  insert into public.trainer_hour_rules
    (gym_id, required_minutes, short_limit_minutes, lop_minutes, off_days, starts_on)
  values (p_gym_id, p_required_minutes, p_short_limit_minutes, p_lop_minutes,
          coalesce(p_off_days, '{}'), public.gym_day(p_gym_id))
  on conflict (gym_id) do update
    set required_minutes = excluded.required_minutes,
        short_limit_minutes = excluded.short_limit_minutes,
        lop_minutes = excluded.lop_minutes,
        off_days = excluded.off_days,
        updated_at = now();
end;
$$;

revoke execute on function public.set_trainer_hour_rules(uuid, int, int, int, smallint[]) from public, anon;
grant execute on function public.set_trainer_hour_rules(uuid, int, int, int, smallint[]) to authenticated;

-- Permissions ----------------------------------------------------------------------

create table public.work_permissions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  starts_at time not null,
  ends_at time not null,
  reason text not null check (reason in ('medical', 'family', 'personal', 'travel', 'other')),
  note text check (char_length(note) <= 200),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index on public.work_permissions (gym_id, day);
create index on public.work_permissions (trainer_id);

alter table public.work_permissions enable row level security;

-- Trainers see their own requests and the answer; owners see all. Writes go through the functions.
create policy "Read work permissions" on public.work_permissions
  for select using (trainer_id = auth.uid() or public.has_gym_role(gym_id, array['owner']));

-- Trainers ask. Owners get a push.
create function public.request_permission(
  p_gym_id uuid, p_day date, p_starts_at time, p_ends_at time, p_reason text, p_note text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_name text;
  v_owner uuid;
begin
  if not exists (
    select 1 from public.gym_members
    where gym_id = p_gym_id and user_id = auth.uid() and role = 'trainer' and status = 'active'
  ) then
    raise exception 'Only trainers ask for permission';
  end if;
  if p_day < public.gym_day(p_gym_id) - 7 or p_day > public.gym_day(p_gym_id) + 60 then
    raise exception 'Pick a day within the last week or the next two months';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'The end time must be after the start time';
  end if;

  insert into public.work_permissions (gym_id, trainer_id, day, starts_at, ends_at, reason, note)
  values (p_gym_id, auth.uid(), p_day, p_starts_at, p_ends_at, p_reason, nullif(trim(p_note), ''))
  returning id into v_id;

  select full_name into v_name from public.profiles where id = auth.uid();
  for v_owner in
    select user_id from public.gym_members
    where gym_id = p_gym_id and role = 'owner' and status = 'active'
  loop
    perform public.notify(p_gym_id, v_owner, 'attendance',
      coalesce(v_name, 'A trainer') || ' asked for permission',
      to_char(p_day, 'FMDD Mon') || ', ' || to_char(p_starts_at, 'FMHH12:MI AM') || ' to '
        || to_char(p_ends_at, 'FMHH12:MI AM') || '.');
  end loop;
  return v_id;
end;
$$;

revoke execute on function public.request_permission(uuid, date, time, time, text, text) from public, anon;
grant execute on function public.request_permission(uuid, date, time, time, text, text) to authenticated;

-- Trainers take back a request the owner hasn't answered.
create function public.cancel_permission(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.work_permissions
  where id = p_id and trainer_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'Only a request still waiting can be cancelled';
  end if;
end;
$$;

revoke execute on function public.cancel_permission(uuid) from public, anon;
grant execute on function public.cancel_permission(uuid) to authenticated;

-- Owners approve or reject. The trainer gets a push.
create function public.decide_permission(p_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.work_permissions;
begin
  select * into v_row from public.work_permissions where id = p_id;
  if v_row is null or not public.has_gym_role(v_row.gym_id, array['owner']) then
    raise exception 'Only owners answer permission requests';
  end if;
  update public.work_permissions
  set status = case when p_approve then 'approved' else 'rejected' end,
      decided_by = auth.uid(), decided_at = now()
  where id = p_id;
  perform public.notify(v_row.gym_id, v_row.trainer_id, 'attendance',
    'Permission ' || case when p_approve then 'approved' else 'not approved' end,
    to_char(v_row.day, 'FMDD Mon') || ', ' || to_char(v_row.starts_at, 'FMHH12:MI AM') || ' to '
      || to_char(v_row.ends_at, 'FMHH12:MI AM') || '.');
end;
$$;

revoke execute on function public.decide_permission(uuid, boolean) from public, anon;
grant execute on function public.decide_permission(uuid, boolean) to authenticated;

-- The owner's LOP report ------------------------------------------------------------

-- Every working day of a month, per active trainer, up to yesterday (today
-- isn't over): minutes worked and approved permission minutes. Days before the
-- rules were saved or before the trainer joined are left out. Owners only.
create function public.trainer_hours_month(p_gym_id uuid, p_month date)
returns table (
  trainer_id uuid, full_name text, day date, worked_minutes int, longest_visit_minutes int,
  permission_minutes int
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_rules public.trainer_hour_rules;
  v_today date := public.gym_day(p_gym_id);
  v_tz text;
begin
  if not public.has_gym_role(p_gym_id, array['owner']) then
    raise exception 'Only owners see trainer hours';
  end if;
  select * into v_rules from public.trainer_hour_rules r where r.gym_id = p_gym_id;
  if v_rules is null then
    return;
  end if;
  select g.time_zone into v_tz from public.gyms g where g.id = p_gym_id;

  return query
  select gm.user_id, p.full_name, d.day::date,
         coalesce(a.worked_minutes, 0),
         coalesce(a.longest_visit_minutes, 0),
         coalesce((
           select sum(extract(epoch from wp.ends_at - wp.starts_at) / 60)::int
           from public.work_permissions wp
           where wp.gym_id = p_gym_id and wp.trainer_id = gm.user_id and wp.day = d.day::date
             and wp.status = 'approved'
         ), 0)
  from public.gym_members gm
  join public.profiles p on p.id = gm.user_id
  cross join generate_series(
    greatest(date_trunc('month', p_month)::date, v_rules.starts_on),
    least((date_trunc('month', p_month) + interval '1 month - 1 day')::date, v_today - 1),
    interval '1 day'
  ) as d(day)
  left join public.attendance a
    on a.gym_id = p_gym_id and a.user_id = gm.user_id and a.day = d.day::date
  where gm.gym_id = p_gym_id and gm.role = 'trainer' and gm.status = 'active'
    and d.day::date >= (gm.joined_at at time zone v_tz)::date
    and not extract(dow from d.day)::smallint = any (v_rules.off_days)
  order by p.full_name, d.day;
end;
$$;

revoke execute on function public.trainer_hours_month(uuid, date) from public, anon;
grant execute on function public.trainer_hours_month(uuid, date) to authenticated;
