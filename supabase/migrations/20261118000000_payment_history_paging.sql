-- Payment history paging (perf audit, 2026-11-18). The staff Payment history screen loaded every
-- membership and online payment of the branch to show one line per member. This returns those
-- lines, a page at a time, with the name search done here. Same numbers and order as the app's
-- paymentsByMember(): memberships counted and summed per member, last payment = when the newest
-- was recorded, "paying now" = an in-app payment started in the last 20 minutes (LINK_MINUTES),
-- people paying now first, then newest payment, then name. Runs as the caller, so RLS decides
-- what comes back (staff see the branch, a member only their own).
-- total is the number of members matching before paging.
create function public.gym_payment_history_page(
  p_gym_id uuid, p_query text default '', p_limit int default 50, p_offset int default 0
)
returns table (
  member_id uuid, member_name text, payments bigint, total_cents bigint, currency text,
  last_paid_at timestamptz, pending bigint, total bigint
)
language plpgsql stable set search_path = '' as $$
declare
  v_like text := '%' || replace(replace(replace(lower(trim(coalesce(p_query, ''))), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  if p_limit not between 1 and 200 or p_offset < 0 then
    raise exception 'Bad page';
  end if;
  return query
    with paid as (
      select m.member_id, count(*) as payments,
             coalesce(sum(m.amount_paid_cents), 0)::bigint as total_cents,
             min(pl.currency) as currency, max(m.created_at) as last_paid_at
      from public.memberships m
      join public.membership_plans pl on pl.id = m.plan_id
      where pl.gym_id = p_gym_id
      group by m.member_id
    ), paying as (
      select o.member_id, count(*) as pending, min(o.currency) as currency
      from public.online_payments o
      where o.gym_id = p_gym_id and o.status = 'created'
        and o.created_at > now() - interval '20 minutes'
      group by o.member_id
    )
    select coalesce(a.member_id, b.member_id), pr.full_name,
           coalesce(a.payments, 0), coalesce(a.total_cents, 0),
           coalesce(a.currency, b.currency), a.last_paid_at, coalesce(b.pending, 0),
           count(*) over ()
    from paid a
    full join paying b on b.member_id = a.member_id
    join public.profiles pr on pr.id = coalesce(a.member_id, b.member_id)
    where v_like = '%%' or lower(pr.full_name) like v_like escape '\'
    order by coalesce(b.pending, 0) > 0 desc, a.last_paid_at desc nulls last,
             pr.full_name, coalesce(a.member_id, b.member_id)
    limit p_limit offset p_offset;
end;
$$;

revoke execute on function public.gym_payment_history_page(uuid, text, int, int) from public, anon;
grant execute on function public.gym_payment_history_page(uuid, text, int, int) to authenticated;
