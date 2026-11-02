-- Membership offers.
--
-- 1. Plan offers: an owner puts a plan on offer for a while, as a percentage
--    (1–90%) or a flat amount off, with an optional label ("Diwali offer").
--    Members see the plan's price struck through next to the offer price, and
--    both online payments and the front desk use the offer price.
-- 2. Loyalty offer: an owner gives members who have paid without a break for
--    N months (default 2 in the app) a percentage off every renewal after that.
--    A break longer than 7 days between memberships starts the count again;
--    complimentary memberships don't count. Off until the owner sets it.
--    When both apply, the member gets whichever takes more off; they don't stack.
-- 3. Saved offers: owners and supervisors save an announcement once and post it
--    again from New announcement.
--
-- The app mirrors the price rules in src/features/memberships/offers.ts.

-- 1. Plan offers ------------------------------------------------------------

alter table public.membership_plans
  add column offer_type text check (offer_type in ('percent', 'flat')),
  add column offer_value int,
  add column offer_label text check (length(offer_label) <= 30),
  add column offer_starts_on date,
  add column offer_ends_on date,
  add constraint membership_plans_offer_check check (
    (offer_type is null and offer_value is null and offer_ends_on is null and offer_starts_on is null)
    or (
      offer_type is not null and offer_value > 0 and offer_ends_on is not null
      and (offer_type <> 'percent' or offer_value <= 90)
      and (offer_type <> 'flat' or offer_value < price_cents)
      and (offer_starts_on is null or offer_starts_on <= offer_ends_on)
    )
  );

-- How much the plan's offer takes off on p_day, in paise; 0 without one.
-- Percent offers round to whole rupees so prices stay tidy.
create function public.plan_offer_cents(p_plan public.membership_plans, p_day date)
returns int
language sql immutable set search_path = '' as $$
  select case
    when p_plan.offer_type is null or p_day > p_plan.offer_ends_on
      or (p_plan.offer_starts_on is not null and p_day < p_plan.offer_starts_on) then 0
    when p_plan.offer_type = 'flat' then least(p_plan.offer_value, p_plan.price_cents)
    else least(round(p_plan.price_cents * p_plan.offer_value / 10000.0)::int * 100, p_plan.price_cents)
  end
$$;

-- 2. Loyalty offer ----------------------------------------------------------

alter table public.gyms
  add column loyalty_months int check (loyalty_months between 1 and 24),
  add column loyalty_percent int check (loyalty_percent between 1 and 50),
  add constraint gyms_loyalty_check check ((loyalty_months is null) = (loyalty_percent is null));

grant select (loyalty_months, loyalty_percent) on public.gyms to authenticated;

-- Owners: switch the loyalty offer on (months and percent) or off (null, null).
create function public.set_loyalty_offer(p_gym_id uuid, p_months int, p_percent int)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_gym_role(p_gym_id, array['owner']) then
    raise exception 'Only owners change the loyalty offer';
  end if;
  if (p_months is null) <> (p_percent is null) then
    raise exception 'Set both the months and the discount';
  end if;
  if p_months is not null and (p_months not between 1 and 24) then
    raise exception 'Pick 1 to 24 months';
  end if;
  if p_percent is not null and (p_percent not between 1 and 50) then
    raise exception 'Pick 1 to 50%% off';
  end if;
  update public.gyms
  set loyalty_months = p_months, loyalty_percent = p_percent
  where id = p_gym_id;
end;
$$;

revoke execute on function public.set_loyalty_offer(uuid, int, int) from public, anon;
grant execute on function public.set_loyalty_offer(uuid, int, int) to authenticated;

-- Days the member has paid without a break up to p_start, counting back from
-- their latest membership. A gap of up to 7 days between memberships is fine.
create function public.loyalty_streak_days(p_gym_id uuid, p_member_id uuid, p_start date)
returns int
language plpgsql stable security definer set search_path = '' as $$
declare
  v_from date := p_start;
  v_m record;
begin
  for v_m in
    select m.starts_on, m.ends_on
    from public.memberships m
    join public.membership_plans mp on mp.id = m.plan_id
    where m.member_id = p_member_id and mp.gym_id = p_gym_id
      and m.starts_on < p_start
      and m.payment_method is distinct from 'complimentary'
    order by m.ends_on desc
  loop
    exit when v_m.ends_on < v_from - 8;
    v_from := least(v_from, v_m.starts_on);
  end loop;
  return p_start - v_from;
end;
$$;

revoke execute on function public.loyalty_streak_days(uuid, uuid, date) from public, anon, authenticated;

-- What a member pays for a plan bought now, starting the day after their last
-- membership ends (or today): the plan's price less the bigger of its offer and
-- the loyalty offer, and which offer that was.
create function public.member_plan_price(p_gym_id uuid, p_member_id uuid, p_plan_id uuid)
returns table (price_cents int, offer text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_plan public.membership_plans;
  v_gym public.gyms;
  v_today date := public.gym_day(p_gym_id);
  v_last date;
  v_start date;
  v_plan_off int;
  v_loyal_off int := 0;
begin
  select * into v_plan from public.membership_plans where id = p_plan_id and gym_id = p_gym_id;
  if not found then
    return;
  end if;
  select * into v_gym from public.gyms where id = p_gym_id;
  v_plan_off := public.plan_offer_cents(v_plan, v_today);

  if v_gym.loyalty_months is not null then
    select max(m.ends_on) into v_last
    from public.memberships m
    join public.membership_plans mp on mp.id = m.plan_id
    where m.member_id = p_member_id and mp.gym_id = p_gym_id;
    v_start := greatest(v_today, coalesce(v_last + 1, v_today));
    if public.loyalty_streak_days(p_gym_id, p_member_id, v_start) >= v_gym.loyalty_months * 30 then
      v_loyal_off := round(v_plan.price_cents * v_gym.loyalty_percent / 10000.0)::int * 100;
    end if;
  end if;

  if v_loyal_off > v_plan_off then
    return query select greatest(v_plan.price_cents - v_loyal_off, 0), 'Loyalty offer'::text;
  elsif v_plan_off > 0 then
    return query select greatest(v_plan.price_cents - v_plan_off, 0),
      coalesce(nullif(trim(v_plan.offer_label), ''), 'Offer');
  else
    return query select v_plan.price_cents, null::text;
  end if;
end;
$$;

revoke execute on function public.member_plan_price(uuid, uuid, uuid) from public, anon, authenticated;

-- The signed-in member's price for a plan, for create-payment's preview.
create function public.my_plan_price(p_gym_id uuid, p_plan_id uuid)
returns table (price_cents int, offer text)
language sql stable security definer set search_path = '' as $$
  select * from public.member_plan_price(p_gym_id, auth.uid(), p_plan_id)
  where exists (
    select 1 from public.gym_members
    where gym_id = p_gym_id and user_id = auth.uid() and status = 'active'
  )
$$;

revoke execute on function public.my_plan_price(uuid, uuid) from public, anon;
grant execute on function public.my_plan_price(uuid, uuid) to authenticated;

-- Online payments charge the offer price and remember which offer it was.
alter table public.online_payments
  add column offer text;

create or replace function public.start_online_payment(p_gym_id uuid, p_plan_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.membership_plans;
  v_price int;
  v_offer text;
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
  select p.price_cents, p.offer into v_price, v_offer
  from public.member_plan_price(p_gym_id, auth.uid(), p_plan_id) p;
  if v_price < 100 then
    raise exception 'This plan is free. Ask the front desk to start it.';
  end if;
  if (
    select count(*) from public.online_payments
    where member_id = auth.uid() and created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Too many payment attempts. Please try again in an hour.';
  end if;

  insert into public.online_payments (gym_id, member_id, plan_id, amount_cents, base_cents, currency, offer)
  values (p_gym_id, auth.uid(), p_plan_id, v_price, v_price, v_plan.currency, v_offer)
  returning id into v_id;
  return v_id;
end;
$$;

-- As before, with the offer in the membership's note.
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
    'Paid online (Razorpay ' || p_razorpay_payment_id || ')'
      || coalesce(' · ' || v_pay.offer, ''),
    null
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
           || coalesce(' (' || v_pay.offer || ')', '')
           || '. Membership runs ' || to_char(v_start, 'DD Mon') || ' – '
           || to_char(v_end, 'DD Mon YYYY') || '.', 500),
         'online-payment:' || p_payment_id
  from public.gym_members gm
  where gm.gym_id = v_pay.gym_id and gm.role in ('owner', 'supervisor') and gm.status = 'active'
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

  return v_membership;
end;
$$;

-- 3. Saved offers -----------------------------------------------------------

create table public.saved_offers (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  audience text not null default 'members' check (audience in ('everyone', 'members', 'staff')),
  title text not null check (length(trim(title)) between 1 and 80),
  body text not null default '' check (length(body) <= 500),
  created_at timestamptz not null default now()
);

create index on public.saved_offers (gym_id, created_at desc);

alter table public.saved_offers enable row level security;

-- Only the people who send announcements see and keep them.
create policy "Managers read saved offers" on public.saved_offers
  for select using (public.can_manage_gym(gym_id));
create policy "Managers save offers" on public.saved_offers
  for insert with check (public.can_manage_gym(gym_id) and created_by = auth.uid());
create policy "Managers remove saved offers" on public.saved_offers
  for delete using (public.can_manage_gym(gym_id));
