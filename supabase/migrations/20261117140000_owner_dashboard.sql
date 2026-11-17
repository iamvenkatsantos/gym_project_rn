-- Owner Home numbers on the server (perf audit, 2026-11-17). Home loaded every person (137 KB),
-- every membership (168 KB) and every trainer link (38 KB) only to count a few things. These return
-- the same numbers and the renewal rows Home shows. p_today is the phone's own date (YYYY-MM-DD),
-- so the numbers match what the app worked out on the phone: same status rules as
-- src/features/memberships/rules.ts (membershipStatus, renewalsDue), nothing is read in a new way.
-- Only owners and supervisors (the only ones who see this screen) get anything back.

-- Active members, renewals due, active members with no trainer, birthdays today.
-- A membership is "active" when it has started and has at least one day left (expiring included).
-- Renewals due: each member's latest membership has 1-7 days left, or ended in the last 30 days.
create function public.owner_dashboard_counts(p_gym_id uuid, p_today date)
returns table (active_members int, renewals_due int, no_trainer int, birthdays_today int)
language sql stable security definer set search_path = '' as $$
  with latest as (
    select distinct on (m.member_id) m.starts_on, m.ends_on
    from public.memberships m
    join public.membership_plans p on p.id = m.plan_id
    where p.gym_id = p_gym_id and public.can_manage_gym(p_gym_id)
    order by m.member_id, m.ends_on desc, m.created_at desc
  ), people as (
    select gm.user_id, cd.date_of_birth
    from public.gym_members gm
    left join public.contact_details cd on cd.user_id = gm.user_id
    where gm.gym_id = p_gym_id and gm.role = 'member' and gm.status = 'active'
      and public.can_manage_gym(p_gym_id)
  )
  select
    (select count(*) from latest
      where starts_on <= p_today and ends_on >= p_today)::int,
    (select count(*) from latest
      where starts_on <= p_today
        and ((ends_on >= p_today and ends_on - p_today + 1 <= 7)
             or (ends_on < p_today and ends_on >= p_today - 30)))::int,
    (select count(*) from people pe
      where not exists (
        select 1 from public.member_trainers mt
        where mt.gym_id = p_gym_id and mt.member_id = pe.user_id))::int,
    -- 29 Feb counts on 28 Feb in years without one, like isBirthdayToday.
    (select count(*) from people pe
      where pe.date_of_birth is not null
        and extract(month from pe.date_of_birth) = extract(month from p_today)
        and least(extract(day from pe.date_of_birth),
                  extract(day from (date_trunc('month', p_today::timestamp) + interval '1 month - 1 day')))
            = extract(day from p_today))::int
$$;

-- The renewals Home lists (soonest to end first), as memberships rows so the app embeds the plan,
-- member and pauses as usual. Runs as the caller: the memberships RLS decides what comes back.
create function public.gym_renewals_due(p_gym_id uuid, p_today date, p_limit int default 2)
returns setof public.memberships
language sql stable set search_path = '' as $$
  select r.*
  from (
    select distinct on (m.member_id) m.*
    from public.memberships m
    join public.membership_plans p on p.id = m.plan_id
    where p.gym_id = p_gym_id
    order by m.member_id, m.ends_on desc, m.created_at desc
  ) r
  where r.starts_on <= p_today
    and ((r.ends_on >= p_today and r.ends_on - p_today + 1 <= 7)
         or (r.ends_on < p_today and r.ends_on >= p_today - 30))
  order by r.ends_on, r.id
  limit least(greatest(p_limit, 1), 100)
$$;

revoke execute on function public.owner_dashboard_counts(uuid, date) from public, anon;
grant execute on function public.owner_dashboard_counts(uuid, date) to authenticated;
revoke execute on function public.gym_renewals_due(uuid, date, int) from public, anon;
grant execute on function public.gym_renewals_due(uuid, date, int) to authenticated;
