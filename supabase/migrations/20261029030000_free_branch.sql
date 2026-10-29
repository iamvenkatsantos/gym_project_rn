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

-- Admins only: free time for a branch (Venkat, 2026-10-29), 1 to 12 months,
-- running on from the paid year (or from today if it lapsed). Recorded as a
-- ₹0 manual payment so it shows in the branch's paid years.
create function public.admin_give_free_months(p_gym_id uuid, p_months int) returns date
language plpgsql security definer set search_path = '' as $$
declare
  v_bill record;
  v_today date;
  v_start date;
  v_end date;
  v_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Only CoreFit Gym admins give free time';
  end if;
  if p_months is null or p_months not between 1 and 12 then
    raise exception 'Pick 1 to 12 months';
  end if;
  select * into v_bill from public.branch_yearly_bill(p_gym_id);
  if not found then
    raise exception 'That branch doesn''t exist';
  end if;
  v_today := public.gym_day(p_gym_id);
  select greatest(v_today, coalesce(paid_until + 1, v_today)) into v_start
  from public.gyms where id = p_gym_id for update;
  v_end := (v_start + make_interval(months => p_months))::date - 1;

  insert into public.subscription_payments (
    gym_id, paid_by, method, fee_cents, addon_cents, amount_cents, currency, status,
    period_start, period_end, note, paid_at
  ) values (
    p_gym_id, auth.uid(), 'manual', v_bill.fee_cents, v_bill.addon_cents, 0, v_bill.currency,
    'paid', v_start, v_end,
    'Free ' || p_months || case when p_months = 1 then ' month' else ' months' end, now()
  ) returning id into v_id;
  update public.gyms set paid_until = v_end where id = p_gym_id;

  insert into public.notifications (gym_id, recipient_id, kind, title, body, dedupe_key)
  select p_gym_id, gm.user_id, 'membership', 'CoreFit Gym plan',
         left(g.name || ' is free until ' || to_char(v_end, 'DD Mon YYYY') || '.', 500),
         'subscription:' || v_id
  from public.gym_members gm
  join public.gyms g on g.id = gm.gym_id
  where gm.gym_id = p_gym_id and gm.role = 'owner' and gm.status = 'active'
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

  return v_end;
end;
$$;

revoke execute on function public.admin_give_free_months(uuid, int) from public, anon;
grant execute on function public.admin_give_free_months(uuid, int) to authenticated;
