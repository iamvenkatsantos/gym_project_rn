-- Late check-ins in a row cost trainers LOP.
--
-- Owners switch it on next to the working-hours rules: a trainer whose first
-- check-in of a working day is more than late_after_minutes after the branch
-- opens is late, unless approved permission starts by then. Every
-- late_streak_days late working days in a row cost late_lop_minutes of LOP,
-- then the count starts again. Off days are skipped; an on-time or absent day
-- resets the count. Branches open 24 hours have no opening time, so nobody is
-- late there. The maths is in the app (applyLateStreaks in
-- src/features/trainer-hours/rules.ts); the server hands over the times.

alter table public.trainer_hour_rules
  -- Null: late check-ins cost nothing.
  add column late_after_minutes int check (late_after_minutes between 0 and 240),
  add column late_streak_days int not null default 2 check (late_streak_days between 1 and 7),
  add column late_lop_minutes int not null default 240 check (late_lop_minutes between 30 and 16 * 60);

-- Owners: the late rule, or null to switch it off. Saved after the working
-- hours (set_trainer_hour_rules), which create the row.
create function public.set_trainer_late_rule(
  p_gym_id uuid, p_late_after_minutes int, p_streak_days int, p_lop_minutes int
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_gym_role(p_gym_id, array['owner']) then
    raise exception 'Only owners set working hours';
  end if;
  update public.trainer_hour_rules
  set late_after_minutes = p_late_after_minutes,
      late_streak_days = p_streak_days,
      late_lop_minutes = p_lop_minutes,
      updated_at = now()
  where gym_id = p_gym_id;
  if not found then
    raise exception 'Set working hours first';
  end if;
end;
$$;

revoke execute on function public.set_trainer_late_rule(uuid, int, int, int) from public, anon;
grant execute on function public.set_trainer_late_rule(uuid, int, int, int) to authenticated;

-- As before, plus when each day's first check-in was, when the earliest
-- approved permission starts and when the branch opens, all as minutes after
-- midnight in the branch's time zone (null when there's none).
drop function public.trainer_hours_month(uuid, date);

create function public.trainer_hours_month(p_gym_id uuid, p_month date)
returns table (
  trainer_id uuid, full_name text, day date, worked_minutes int, longest_visit_minutes int,
  permission_minutes int, first_in_minute int, permission_from_minute int, opens_minute int
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
         end
  from public.gym_members gm
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
