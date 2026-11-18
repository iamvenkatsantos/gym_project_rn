-- Renewals screen (perf audit, 2026-11-18). gym_renewals_due() capped its page at 100 rows, enough
-- for the 2 Home lists. The Renewals screen lists everyone due (ending this week plus ended in the
-- last 30 days) from the same function instead of loading every membership, so the cap goes up to
-- 1000. Same rows, same order, same access (runs as the caller).
create or replace function public.gym_renewals_due(p_gym_id uuid, p_today date, p_limit int default 2)
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
  limit least(greatest(p_limit, 1), 1000)
$$;

revoke execute on function public.gym_renewals_due(uuid, date, int) from public, anon;
grant execute on function public.gym_renewals_due(uuid, date, int) to authenticated;
