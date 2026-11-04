-- Evening shifts for trainers.
--
-- Owners set when the evening shift starts (Trainer hours -> Rules) and mark
-- which trainers work it. An evening trainer is late against the evening
-- start, everyone else against opening time. Secret like the other rules:
-- owners only. With no evening start set, everyone is measured from opening.

alter table public.trainer_hour_rules add column evening_starts_at time;

create table public.trainer_shifts (
  gym_id uuid not null references public.gyms (id) on delete cascade,
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  shift text not null check (shift in ('morning', 'evening')),
  updated_at timestamptz not null default now(),
  primary key (gym_id, trainer_id)
);

alter table public.trainer_shifts enable row level security;

-- Owners only. Writes go through set_trainer_shift.
create policy "Owners read trainer shifts" on public.trainer_shifts
  for select using (public.has_gym_role(gym_id, array['owner']));

-- Owners: when the evening shift starts, or null for no evening shift.
create function public.set_evening_shift_start(p_gym_id uuid, p_starts_at time) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_gym_role(p_gym_id, array['owner']) then
    raise exception 'Only owners set working hours';
  end if;
  update public.trainer_hour_rules
  set evening_starts_at = p_starts_at, updated_at = now()
  where gym_id = p_gym_id;
  if not found then
    raise exception 'Set working hours first';
  end if;
end;
$$;

revoke execute on function public.set_evening_shift_start(uuid, time) from public, anon;
grant execute on function public.set_evening_shift_start(uuid, time) to authenticated;

-- Owners: a trainer's shift at the branch.
create function public.set_trainer_shift(p_gym_id uuid, p_trainer_id uuid, p_shift text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_gym_role(p_gym_id, array['owner']) then
    raise exception 'Only owners set working hours';
  end if;
  if not exists (
    select 1 from public.gym_members
    where gym_id = p_gym_id and user_id = p_trainer_id and role = 'trainer' and status = 'active'
  ) then
    raise exception 'Pick a trainer from this gym';
  end if;
  insert into public.trainer_shifts (gym_id, trainer_id, shift)
  values (p_gym_id, p_trainer_id, p_shift)
  on conflict (gym_id, trainer_id) do update set shift = excluded.shift, updated_at = now();
end;
$$;

revoke execute on function public.set_trainer_shift(uuid, uuid, text) from public, anon;
grant execute on function public.set_trainer_shift(uuid, uuid, text) to authenticated;

-- As before, plus start_minute: when this trainer's shift starts (evening
-- start for evening trainers, otherwise opening), minutes after midnight.
drop function public.trainer_hours_month(uuid, date);

create function public.trainer_hours_month(p_gym_id uuid, p_month date)
returns table (
  trainer_id uuid, full_name text, day date, worked_minutes int, longest_visit_minutes int,
  permission_minutes int, first_in_minute int, permission_from_minute int, opens_minute int,
  start_minute int
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_rules public.trainer_hour_rules;
  v_today date := public.gym_day(p_gym_id);
  v_tz text;
  v_opens time;
begin
  if not public.has_gym_role(p_gym_id, array['owner']) then
    raise exception 'Only owners see trainer hours';
  end if;
  select * into v_rules from public.trainer_hour_rules r where r.gym_id = p_gym_id;
  if v_rules is null then
    return;
  end if;
  select g.time_zone, g.opens_at into v_tz, v_opens from public.gyms g where g.id = p_gym_id;

  return query
  select gm.user_id, p.full_name, d.day::date,
         coalesce(a.worked_minutes, 0),
         coalesce(a.longest_visit_minutes, 0),
         coalesce(perm.minutes, 0),
         case when a.checked_in_at is not null then
           (extract(hour from a.checked_in_at at time zone v_tz) * 60
             + extract(minute from a.checked_in_at at time zone v_tz))::int
         end,
         perm.from_minute,
         case when v_opens is not null then
           (extract(hour from v_opens) * 60 + extract(minute from v_opens))::int
         end,
         case
           when ts.shift = 'evening' and v_rules.evening_starts_at is not null then
             (extract(hour from v_rules.evening_starts_at) * 60
               + extract(minute from v_rules.evening_starts_at))::int
           when v_opens is not null then
             (extract(hour from v_opens) * 60 + extract(minute from v_opens))::int
         end
  from public.gym_members gm
  left join public.trainer_shifts ts on ts.gym_id = gm.gym_id and ts.trainer_id = gm.user_id
  join public.profiles p on p.id = gm.user_id
  cross join generate_series(
    greatest(date_trunc('month', p_month)::date, v_rules.starts_on),
    least((date_trunc('month', p_month) + interval '1 month - 1 day')::date, v_today - 1),
    interval '1 day'
  ) as d(day)
  left join public.attendance a
    on a.gym_id = p_gym_id and a.user_id = gm.user_id and a.day = d.day::date
  left join lateral (
    select sum(extract(epoch from wp.ends_at - wp.starts_at) / 60)::int as minutes,
           min(extract(hour from wp.starts_at) * 60 + extract(minute from wp.starts_at))::int as from_minute
    from public.work_permissions wp
    where wp.gym_id = p_gym_id and wp.trainer_id = gm.user_id and wp.day = d.day::date
      and wp.status = 'approved'
  ) perm on true
  where gm.gym_id = p_gym_id and gm.role = 'trainer' and gm.status = 'active'
    and d.day::date >= (gm.joined_at at time zone v_tz)::date
    and not extract(dow from d.day)::smallint = any (v_rules.off_days)
  order by p.full_name, d.day;
end;
$$;

revoke execute on function public.trainer_hours_month(uuid, date) from public, anon;
grant execute on function public.trainer_hours_month(uuid, date) to authenticated;
