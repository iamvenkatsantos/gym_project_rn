-- People and Payments load 30 at a time (Venkat, 2026-11-17): with ~300 members both tabs fetched
-- everyone (gym_people ~137 KB, every membership ever ~168 KB) before showing anything.
-- People pages through gym_people() itself (PostgREST filters, orders and ranges its rows), so it
-- only needs the counts for the filter chips. Payments gets each member's latest membership.

-- How many people each People filter chip holds. Runs as the caller; gym_people() checks
-- can_manage_gym(), so anyone else gets zeros.
create or replace function public.gym_people_counts(p_gym_id uuid)
returns table (
  everyone int, member int, trainer int, supervisor int, owner int, suspended int
)
language sql stable set search_path = '' as $$
  select count(*)::int,
         (count(*) filter (where status <> 'suspended' and role = 'member'))::int,
         (count(*) filter (where status <> 'suspended' and role = 'trainer'))::int,
         (count(*) filter (where status <> 'suspended' and role = 'supervisor'))::int,
         (count(*) filter (where status <> 'suspended' and role = 'owner'))::int,
         (count(*) filter (where status = 'suspended'))::int
  from public.gym_people(p_gym_id)
$$;

revoke execute on function public.gym_people_counts(uuid) from public, anon;
grant execute on function public.gym_people_counts(uuid) to authenticated;

-- Each member's latest membership at the branch (the one ending last), for the Payments tab.
-- Runs as the caller, so the memberships RLS decides what comes back. Returns memberships rows,
-- so the app embeds the plan, member and pauses and pages it with order + range.
create or replace function public.gym_latest_memberships(p_gym_id uuid)
returns setof public.memberships
language sql stable set search_path = '' as $$
  select distinct on (m.member_id) m.*
  from public.memberships m
  join public.membership_plans p on p.id = m.plan_id
  where p.gym_id = p_gym_id
  order by m.member_id, m.ends_on desc, m.created_at desc
$$;

revoke execute on function public.gym_latest_memberships(uuid) from public, anon;
grant execute on function public.gym_latest_memberships(uuid) to authenticated;
