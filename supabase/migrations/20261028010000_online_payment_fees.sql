-- Online payments, Razorpay's fees. Razorpay takes a Route transfer fee (0.25% +
-- GST) from the platform balance on top of each transfer to the owner, which the
-- transfer used to ignore. create-payment and razorpay-webhook now leave room for
-- it (supabase/functions/_shared/fees.ts).
--
-- A branch can also pass Razorpay's fees on to its members (on by default): for a
-- ₹1,000 plan the member pays ₹1,027.20 and the owner receives the full ₹1,000.
-- The membership and Insights still count the plan's price, not the charges.

alter table public.gyms
  add column online_fees_on_member boolean not null default true;

-- amount_cents stays what the member pays. base_cents is the plan's price and
-- charges_cents the fees added on top (0 when the owner bears them). The transfer
-- columns record what reached the owner and the transfer fee Razorpay took, so
-- the admin sees what CoreFit Gym really keeps: cut − transfer fee, when the
-- owner bears it.
alter table public.online_payments
  add column base_cents int check (base_cents >= 100),
  add column charges_cents int not null default 0 check (charges_cents >= 0),
  add column transfer_cents int,
  add column transfer_fee_cents int;

update public.online_payments set base_cents = amount_cents where base_cents is null;

-- As before, recording the plan's price as the base. create-payment adds the
-- charges and CoreFit Gym's cut once it has Razorpay's rates.
create or replace function public.start_online_payment(p_gym_id uuid, p_plan_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.membership_plans;
  v_id uuid;
begin
  if not exists (
    select 1 from public.gym_members
    where gym_id = p_gym_id and user_id = auth.uid() and role = 'member' and status = 'active'
  ) then
    raise exception 'Only members of this gym can pay online';
  end if;
  if not exists (select 1 from public.gyms where id = p_gym_id and online_payments) then
    raise exception 'This gym doesn''t take online payments yet. Please pay at the front desk.';
  end if;
  select * into v_plan from public.membership_plans
  where id = p_plan_id and gym_id = p_gym_id and active;
  if not found then
    raise exception 'That plan isn''t on sale any more';
  end if;
  if v_plan.price_cents < 100 then
    raise exception 'This plan is free. Ask the front desk to start it.';
  end if;
  if (
    select count(*) from public.online_payments
    where member_id = auth.uid() and created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Too many payment attempts. Please try again in an hour.';
  end if;

  insert into public.online_payments (gym_id, member_id, plan_id, amount_cents, base_cents, currency)
  values (p_gym_id, auth.uid(), p_plan_id, v_plan.price_cents, v_plan.price_cents, v_plan.currency)
  returning id into v_id;
  return v_id;
end;
$$;

-- As before, but the membership records the plan's price rather than what the
-- member paid with the charges, and the cut set by create-payment stays.
create or replace function public.complete_online_payment(
  p_payment_id uuid, p_razorpay_payment_id text, p_amount_cents int, p_fee_cents int
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_pay public.online_payments;
  v_plan public.membership_plans;
  v_today date;
  v_last date;
  v_start date;
  v_end date;
  v_membership uuid;
  v_member text;
  v_amount text;
begin
  select * into v_pay from public.online_payments where id = p_payment_id for update;
  if not found then
    raise exception 'Unknown payment %', p_payment_id;
  end if;
  if v_pay.status = 'paid' then
    return v_pay.membership_id;
  end if;
  -- Two of the member's payments confirmed at once would both stack onto the same
  -- end date; take them one at a time so the second starts after the first.
  perform pg_advisory_xact_lock(hashtextextended(v_pay.gym_id::text || v_pay.member_id::text, 0));

  if p_amount_cents is distinct from v_pay.amount_cents then
    raise exception 'Paid % but the payment was for %', p_amount_cents, v_pay.amount_cents;
  end if;

  select * into v_plan from public.membership_plans where id = v_pay.plan_id;
  v_today := public.gym_day(v_pay.gym_id);
  select max(m.ends_on) into v_last
  from public.memberships m
  join public.membership_plans mp on mp.id = m.plan_id
  where m.member_id = v_pay.member_id and mp.gym_id = v_pay.gym_id;
  v_start := greatest(v_today, coalesce(v_last + 1, v_today));
  v_end := v_start + v_plan.duration_days - 1;

  insert into public.memberships (
    member_id, plan_id, starts_on, ends_on, amount_paid_cents, payment_method, note, recorded_by
  ) values (
    v_pay.member_id, v_pay.plan_id, v_start, v_end, coalesce(v_pay.base_cents, v_pay.amount_cents), 'online',
    'Paid online (Razorpay ' || p_razorpay_payment_id || ')', null
  ) returning id into v_membership;

  update public.online_payments
  set status = 'paid',
      razorpay_payment_id = p_razorpay_payment_id,
      membership_id = v_membership,
      fee_cents = p_fee_cents,
      paid_at = now()
  where id = p_payment_id;

  select full_name into v_member from public.profiles where id = v_pay.member_id;
  v_amount := case when v_pay.currency = 'INR' then '₹' else v_pay.currency || ' ' end
    || regexp_replace(to_char(coalesce(v_pay.base_cents, v_pay.amount_cents) / 100.0, 'FM999999990.00'), '\.00$', '');
  insert into public.notifications (gym_id, recipient_id, kind, title, body, dedupe_key)
  select v_pay.gym_id, gm.user_id, 'membership', 'Online payment received',
         left(coalesce(v_member, 'A member') || ' paid ' || v_amount || ' for ' || v_plan.name
           || '. Membership runs ' || to_char(v_start, 'DD Mon') || ' – '
           || to_char(v_end, 'DD Mon YYYY') || '.', 500),
         'online-payment:' || p_payment_id
  from public.gym_members gm
  where gm.gym_id = v_pay.gym_id and gm.role in ('owner', 'supervisor') and gm.status = 'active'
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

  return v_membership;
end;
$$;

-- Admins only: whether a branch's members pay Razorpay's fees on top of the price
-- (true) or the owner bears them (false).
create function public.admin_set_online_fees_on_member(p_gym_id uuid, p_on_member boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only CoreFit Gym admins change who pays the online charges';
  end if;
  update public.gyms set online_fees_on_member = coalesce(p_on_member, true) where id = p_gym_id;
  if not found then
    raise exception 'That branch doesn''t exist';
  end if;
end;
$$;

revoke execute on function public.admin_set_online_fees_on_member(uuid, boolean) from public, anon;
grant execute on function public.admin_set_online_fees_on_member(uuid, boolean) to authenticated;

-- As before, with who pays the online charges.
drop function public.admin_branches();

create function public.admin_branches()
returns table (
  brand_id uuid, brand_name text, gym_id uuid, gym_name text, fee_cents int,
  online_payments boolean, razorpay_account_id text, online_fees_on_member boolean,
  address text, city text, phone text, email text,
  owners jsonb, members int, staff int, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only CoreFit Gym admins see every branch';
  end if;
  return query
    select b.id, b.name, g.id, g.name, g.fee_cents,
           g.online_payments, g.razorpay_account_id, g.online_fees_on_member,
           g.address, g.city, g.phone, g.email,
           coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', p.id, 'full_name', p.full_name, 'email', coalesce(u.email, ''))
                    order by p.full_name)
             from public.gym_members gm
             join public.profiles p on p.id = gm.user_id
             left join auth.users u on u.id = gm.user_id
             where gm.gym_id = g.id and gm.role = 'owner' and gm.status = 'active'
           ), '[]'::jsonb),
           (select count(*)::int from public.gym_members gm
            where gm.gym_id = g.id and gm.role = 'member' and gm.status = 'active'),
           (select count(*)::int from public.gym_members gm
            where gm.gym_id = g.id and gm.role in ('trainer', 'supervisor')
              and gm.status = 'active'),
           g.created_at
    from public.gyms g
    join public.brands b on b.id = g.brand_id
    order by b.name, g.created_at;
end;
$$;

revoke execute on function public.admin_branches() from public, anon;
grant execute on function public.admin_branches() to authenticated;
