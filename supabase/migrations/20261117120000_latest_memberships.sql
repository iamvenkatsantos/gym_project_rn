-- Payments tab paging (perf audit, 2026-11-17). The tab fetched every membership ever recorded
-- (~168 KB at 300 members) only to show each member's latest one. This returns just those, as
-- memberships rows, so the app embeds the plan, member and pauses as before and pages it with
-- order + range (count=exact gives the total). Runs as the caller: the memberships RLS decides
-- what comes back.
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
