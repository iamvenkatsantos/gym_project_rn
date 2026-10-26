-- Report exports for owners: payments, memberships and attendance, as rows the
-- app turns into CSV files. Only the gym's owner may export, so each function
-- checks the caller's role itself; supervisors see these numbers in the app
-- but can't take them away. Dates and times are in the gym's own time zone.

-- Refuses anyone but the gym's owner, and periods that are backwards or over a year.
create function public.check_report_access(p_gym_id uuid, p_from date, p_to date) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_gym_role(p_gym_id, array['owner']) then
    raise exception 'Only the gym owner can export reports';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Pick a start date on or before the end date';
  end if;
  if p_to - p_from > 366 then
    raise exception 'Export at most a year at a time';
  end if;
end;
$$;

revoke execute on function public.check_report_access(uuid, date, date) from public, anon, authenticated;

-- Every payment recorded between p_from and p_to (by the day it was recorded).
create function public.export_payments(p_gym_id uuid, p_from date, p_to date)
returns table (
  paid_on date, member_name text, member_email text, plan_name text,
  amount_paid_cents int, currency text, payment_method text,
  starts_on date, ends_on date, recorded_by text, note text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.check_report_access(p_gym_id, p_from, p_to);
  return query
    select public.gym_day(p_gym_id, m.created_at), p.full_name, u.email::text, mp.name,
           m.amount_paid_cents, mp.currency, m.payment_method,
           m.starts_on, m.ends_on, coalesce(r.full_name, ''), m.note
    from public.memberships m
    join public.membership_plans mp on mp.id = m.plan_id
    join public.profiles p on p.id = m.member_id
    left join auth.users u on u.id = m.member_id
    left join public.profiles r on r.id = m.recorded_by
    where mp.gym_id = p_gym_id
      and public.gym_day(p_gym_id, m.created_at) between p_from and p_to
    order by m.created_at, p.full_name;
end;
$$;

revoke execute on function public.export_payments(uuid, date, date) from public, anon;
grant execute on function public.export_payments(uuid, date, date) to authenticated;

-- Every active member with their latest membership, as it stands today.
create function public.export_memberships(p_gym_id uuid)
returns table (
  member_name text, member_email text, joined_on date, plan_name text,
  starts_on date, ends_on date, amount_paid_cents int, currency text, payment_method text
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := public.gym_day(p_gym_id);
begin
  perform public.check_report_access(p_gym_id, v_today, v_today);
  return query
    select p.full_name, u.email::text, public.gym_day(p_gym_id, gm.joined_at), latest.plan_name,
           latest.starts_on, latest.ends_on, latest.amount_paid_cents, latest.currency,
           latest.payment_method
    from public.gym_members gm
    join public.profiles p on p.id = gm.user_id
    left join auth.users u on u.id = gm.user_id
    left join lateral (
      select mp.name as plan_name, m.starts_on, m.ends_on, m.amount_paid_cents, mp.currency,
             m.payment_method
      from public.memberships m
      join public.membership_plans mp on mp.id = m.plan_id
      where m.member_id = gm.user_id and mp.gym_id = p_gym_id
      order by m.ends_on desc, m.created_at desc
      limit 1
    ) latest on true
    where gm.gym_id = p_gym_id and gm.status = 'active' and gm.role = 'member'
    order by latest.ends_on nulls first, p.full_name;
end;
$$;

revoke execute on function public.export_memberships(uuid) from public, anon;
grant execute on function public.export_memberships(uuid) to authenticated;

-- Every check-in between p_from and p_to, one row per person per day.
create function public.export_attendance(p_gym_id uuid, p_from date, p_to date)
returns table (
  day date, full_name text, role text, checked_in text, checked_out text,
  minutes_in_gym int, workouts int
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.check_report_access(p_gym_id, p_from, p_to);
  return query
    select a.day, p.full_name, a.role,
           public.gym_time(p_gym_id, a.checked_in_at, 'HH24:MI'),
           coalesce(public.gym_time(p_gym_id, a.checked_out_at, 'HH24:MI'), ''),
           round(extract(epoch from a.checked_out_at - a.checked_in_at) / 60)::int,
           a.workouts
    from public.attendance a
    join public.profiles p on p.id = a.user_id
    where a.gym_id = p_gym_id and a.day between p_from and p_to
    order by a.day, a.role desc, a.checked_in_at;
end;
$$;

revoke execute on function public.export_attendance(uuid, date, date) from public, anon;
grant execute on function public.export_attendance(uuid, date, date) to authenticated;
