-- A free branch pays nothing (Venkat, 2026-10-29): when the admin sets a
-- branch's fee to 0, the online payments add-on is waived too, so the branch has
-- nothing to pay and is never blocked or locked.
create or replace function public.branch_yearly_bill(p_gym_id uuid)
returns table (fee_cents int, addon_cents int, amount_cents int, currency text)
language sql stable security definer set search_path = '' as $$
  select f.fee, f.addon, f.fee + f.addon, f.currency
  from (
    select coalesce(g.fee_cents, s.branch_fee_cents) as fee,
           case when g.online_payments and coalesce(g.fee_cents, s.branch_fee_cents) > 0
                then s.online_addon_cents else 0 end as addon,
           s.currency
    from public.gyms g
    cross join public.platform_settings s
    where g.id = p_gym_id and s.id
  ) f
$$;
