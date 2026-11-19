-- Payment history paging (perf audit, 2026-11-18). The staff Payment history screen downloaded
-- every membership ever recorded (~168 KB at 300 members) and the last 200 online payments, then
-- summed them per member on the phone. This returns one page of those per-member lines, with the
-- name search done here. Same rules as the app's paymentsByMember():
--   payments / total_cents / last_paid_at   every membership on the branch's plans; paid at = when
--                                           it was recorded (created_at)
--   pending                                 in-app payments still open on Razorpay's page: status
--                                           created and under LINK_MINUTES (20) old
--   order                                   anyone paying now first, then latest payment, then name
-- total is the number of matching members before paging. Owners and supervisors only.
create function public.gym_payment_history_page(
  p_gym_id uuid, p_query text default '', p_limit int default 50, p_offset int default 0
)
returns table (
  member_id uuid, member_name text, payments int, total_cents bigint, currency text,
  last_paid_at timestamptz, pending int, total bigint
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_like text := '%' || replace(replace(replace(lower(trim(coalesce(p_query, ''))), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  if not public.can_manage_gym(p_gym_id) then
    raise exception 'Only owners and supervisors see payment history';
  end if;
  if p_limit not between 1 and 200 or p_offset < 0 then
    raise exception 'Bad page';
  end if;
  return query
    with paid as (
      select m.member_id,
             count(*)::int as payments,
             coalesce(sum(m.amount_paid_cents), 0)::bigint as total_cents,
             min(pl.currency) as currency,
             max(m.created_at) as last_paid_at
      from public.memberships m
      join public.membership_plans pl on pl.id = m.plan_id
      where pl.gym_id = p_gym_id
      group by m.member_id
    ),
    paying as (
      select o.member_id, count(*)::int as pending, min(o.currency) as currency
      from public.online_payments o
      where o.gym_id = p_gym_id and o.status = 'created'
        and o.created_at > now() - interval '20 minutes'
      group by o.member_id
    ),
    lines as (
      select coalesce(paid.member_id, paying.member_id) as member_id,
             coalesce(nullif(p.full_name, ''), 'Member') as member_name,
             coalesce(paid.payments, 0) as payments,
             coalesce(paid.total_cents, 0::bigint) as total_cents,
             coalesce(paid.currency, paying.currency) as currency,
             paid.last_paid_at,
             coalesce(paying.pending, 0) as pending
      from paid
      full join paying on paying.member_id = paid.member_id
      left join public.profiles p on p.id = coalesce(paid.member_id, paying.member_id)
    )
    select l.member_id, l.member_name, l.payments, l.total_cents, l.currency, l.last_paid_at,
           l.pending, count(*) over ()
    from lines l
    where v_like = '%%' or lower(l.member_name) like v_like escape '\'
    order by (l.pending > 0) desc, l.last_paid_at desc nulls last, l.member_name, l.member_id
    limit p_limit offset p_offset;
end;
$$;

revoke execute on function public.gym_payment_history_page(uuid, text, int, int) from public, anon;
grant execute on function public.gym_payment_history_page(uuid, text, int, int) to authenticated;
