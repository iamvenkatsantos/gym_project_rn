-- Owner insights: revenue by month, where each member stands (active, lapsed,
-- not coming in), and the hours members check in. Like report exports these
-- are owner only, so each function checks the caller's role itself. Days and
-- hours are in the gym's own time zone.

create function public.check_insights_access(p_gym_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_gym_role(p_gym_id, array['owner']) then
    raise exception 'Only the gym owner sees insights';
  end if;
end;
$$;

revoke execute on function public.check_insights_access(uuid) from public, anon, authenticated;

-- Money taken per month for the last p_months months, this month included
-- (so far). A payment counts in the month it was recorded; rows recorded
-- before payments were tracked count at the plan's price. new_members counts
-- members whose first membership at this gym was recorded that month.
create function public.revenue_by_month(p_gym_id uuid, p_months int default 6)
returns table (month date, amount_cents bigint, payments int, new_members int, currency text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz text;
  v_this_month date;
  v_currency text;
begin
  perform public.check_insights_access(p_gym_id);
  if p_months not between 1 and 24 then
    raise exception 'Pick between 1 and 24 months';
  end if;
  select g.time_zone into v_tz from public.gyms g where g.id = p_gym_id;
  v_this_month := date_trunc('month', now() at time zone v_tz)::date;
  select coalesce(max(mp.currency), 'INR') into v_currency
    from public.membership_plans mp where mp.gym_id = p_gym_id;
  return query
    with paid as (
      select date_trunc('month', m.created_at at time zone v_tz)::date as month,
             coalesce(m.amount_paid_cents, mp.price_cents) as cents,
             m.created_at = min(m.created_at) over (partition by m.member_id) as is_first
      from public.memberships m
      join public.membership_plans mp on mp.id = m.plan_id
      where mp.gym_id = p_gym_id
    ), months as (
      select (v_this_month - make_interval(months => n))::date as month
      from generate_series(0, p_months - 1) n
    )
    select mo.month, coalesce(sum(p.cents), 0)::bigint, count(p.cents)::int,
           (count(*) filter (where p.is_first))::int, v_currency
    from months mo
    left join paid p on p.month = mo.month
    group by mo.month
    order by mo.month;
end;
$$;

revoke execute on function public.revenue_by_month(uuid, int) from public, anon;
grant execute on function public.revenue_by_month(uuid, int) to authenticated;

-- Every active member with their latest membership (null if they never had
-- one), the last day they checked in and how many days they came in the last
-- 30. The app sorts them into active, expiring, lapsed and not coming in.
create function public.member_insights(p_gym_id uuid)
returns table (
  user_id uuid, full_name text, joined_on date, starts_on date, ends_on date,
  last_visit date, visits_30d int
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date;
begin
  perform public.check_insights_access(p_gym_id);
  v_today := public.gym_day(p_gym_id);
  return query
    select gm.user_id, p.full_name, public.gym_day(p_gym_id, gm.joined_at),
           latest.starts_on, latest.ends_on, visits.last_visit, coalesce(visits.recent, 0)::int
    from public.gym_members gm
    join public.profiles p on p.id = gm.user_id
    left join lateral (
      select m.starts_on, m.ends_on
      from public.memberships m
      join public.membership_plans mp on mp.id = m.plan_id
      where m.member_id = gm.user_id and mp.gym_id = p_gym_id
      order by m.ends_on desc, m.created_at desc
      limit 1
    ) latest on true
    left join lateral (
      select max(a.day) as last_visit, count(*) filter (where a.day > v_today - 30) as recent
      from public.attendance a
      where a.gym_id = p_gym_id and a.user_id = gm.user_id
    ) visits on true
    where gm.gym_id = p_gym_id and gm.status = 'active' and gm.role = 'member'
    order by p.full_name;
end;
$$;

revoke execute on function public.member_insights(uuid) from public, anon;
grant execute on function public.member_insights(uuid) to authenticated;

-- Member check-ins over the last p_days gym days (today included), counted
-- by ISO weekday (1 = Monday) and hour of arrival.
create function public.busiest_hours(p_gym_id uuid, p_days int default 30)
returns table (weekday int, hour int, check_ins int)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz text;
  v_today date;
begin
  perform public.check_insights_access(p_gym_id);
  if p_days not between 1 and 366 then
    raise exception 'Pick between 1 and 366 days';
  end if;
  select g.time_zone into v_tz from public.gyms g where g.id = p_gym_id;
  v_today := (now() at time zone v_tz)::date;
  return query
    select extract(isodow from a.day)::int, extract(hour from a.checked_in_at at time zone v_tz)::int,
           count(*)::int
    from public.attendance a
    where a.gym_id = p_gym_id and a.role = 'member' and a.day > v_today - p_days
    group by 1, 2
    order by 1, 2;
end;
$$;

revoke execute on function public.busiest_hours(uuid, int) from public, anon;
grant execute on function public.busiest_hours(uuid, int) to authenticated;
