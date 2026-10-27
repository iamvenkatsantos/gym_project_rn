-- Online payments, after checking every case: a member whose two payments are
-- confirmed at the same moment (say a second tap on Pay, both completed) got two
-- memberships over the same dates. Completing now waits for the member's other
-- completion, so the second membership starts after the first.

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
    v_pay.member_id, v_pay.plan_id, v_start, v_end, v_pay.amount_cents, 'online',
    'Paid online (Razorpay ' || p_razorpay_payment_id || ')', null
  ) returning id into v_membership;

  update public.online_payments
  set status = 'paid',
      razorpay_payment_id = p_razorpay_payment_id,
      membership_id = v_membership,
      fee_cents = p_fee_cents,
      cut_cents = (
        select v_pay.amount_cents * s.online_cut_bps / 10000
        from public.platform_settings s where s.id
      ),
      paid_at = now()
  where id = p_payment_id;

  select full_name into v_member from public.profiles where id = v_pay.member_id;
  v_amount := case when v_pay.currency = 'INR' then '₹' else v_pay.currency || ' ' end
    || regexp_replace(to_char(v_pay.amount_cents / 100.0, 'FM999999990.00'), '\.00$', '');
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
