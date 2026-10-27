-- Online payments through Razorpay. A member pays for a plan in the app and the
-- money belongs to the gym: it goes to the owner's Razorpay linked account
-- (Route), never to CoreFit Gym, apart from an optional cut that is 0 for now.
-- It's a paid add-on that only the CoreFit Gym admin switches on, per branch.
--
-- The create-payment edge function starts a payment here and opens Razorpay's
-- payment page. Razorpay's signed webhook (razorpay-webhook) completes it, which
-- records the membership like a front-desk payment with method 'online', so it
-- shows in Payments, Insights and the exports like any other.

-- What the add-on costs a branch each month, and CoreFit Gym's cut of each
-- payment in basis points (100 = 1%). The cut is off until the admin sets it.
alter table public.platform_settings
  add column online_addon_cents int not null default 50000
    check (online_addon_cents between 0 and 100000000),
  add column online_cut_bps int not null default 0 check (online_cut_bps between 0 and 2000);

-- Whether the branch takes online payments, and the owner's Razorpay linked
-- account (acc_...) that its payments go to. Only the admin changes either.
alter table public.gyms
  add column online_payments boolean not null default false,
  add column razorpay_account_id text check (razorpay_account_id ~ '^acc_[A-Za-z0-9]{6,32}$');

-- Members need the switch to show Pay now; the linked account stays private.
grant select (online_payments) on public.gyms to authenticated;

create table public.online_payments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid not null references public.membership_plans (id),
  amount_cents int not null check (amount_cents >= 100),
  currency text not null,
  -- created: the payment page is open or was left; paid: the membership is
  -- recorded; expired: the page timed out unpaid.
  status text not null default 'created' check (status in ('created', 'paid', 'expired')),
  razorpay_link_id text unique,
  link_url text,
  razorpay_payment_id text unique,
  membership_id uuid references public.memberships (id) on delete set null,
  -- Razorpay's fee (with GST) and CoreFit Gym's cut, both taken from what the
  -- gym receives.
  fee_cents int,
  cut_cents int not null default 0,
  transfer_id text,
  transfer_error text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index on public.online_payments (gym_id, created_at desc);
create index on public.online_payments (member_id, created_at desc);

alter table public.online_payments enable row level security;

create policy "Members read their online payments" on public.online_payments
  for select using (member_id = auth.uid());
create policy "Staff read their gym's online payments" on public.online_payments
  for select using (public.can_manage_gym(gym_id));

-- Rows only change through the functions below and the edge functions.
revoke insert, update, delete on public.online_payments from anon, authenticated;

-- A member starts paying for a plan at their gym. Returns the payment's id for
-- create-payment, which opens the Razorpay page for it.
create function public.start_online_payment(p_gym_id uuid, p_plan_id uuid) returns uuid
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

  insert into public.online_payments (gym_id, member_id, plan_id, amount_cents, currency)
  values (p_gym_id, auth.uid(), p_plan_id, v_plan.price_cents, v_plan.currency)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.start_online_payment(uuid, uuid) from public, anon;
grant execute on function public.start_online_payment(uuid, uuid) to authenticated;

-- Internal: the webhook calls this once Razorpay's signature checks out. Records
-- the membership, starting the day after the member's current one ends (or
-- today), and tells owners and supervisors. Safe to call twice: a paid payment
-- returns its membership. The member hears from the memberships_announce trigger.
create function public.complete_online_payment(
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

revoke execute on function public.complete_online_payment(uuid, text, int, int)
  from public, anon, authenticated;

-- Admins only: switch online payments on or off for a branch, and set the
-- owner's Razorpay linked account its payments go to (null clears it).
create function public.admin_set_online_payments(
  p_gym_id uuid, p_enabled boolean, p_account_id text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_account text := nullif(trim(coalesce(p_account_id, '')), '');
begin
  if not public.is_platform_admin() then
    raise exception 'Only CoreFit Gym admins switch on online payments';
  end if;
  if v_account is not null and v_account !~ '^acc_[A-Za-z0-9]{6,32}$' then
    raise exception 'Enter the linked account ID from Razorpay Route, like acc_XXXXXXXXXXXXXX';
  end if;
  update public.gyms
  set online_payments = coalesce(p_enabled, false), razorpay_account_id = v_account
  where id = p_gym_id;
  if not found then
    raise exception 'That branch doesn''t exist';
  end if;
end;
$$;

revoke execute on function public.admin_set_online_payments(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_online_payments(uuid, boolean, text) to authenticated;

-- As before, with each branch's online payments switch and linked account.
drop function public.admin_branches();

create function public.admin_branches()
returns table (
  brand_id uuid, brand_name text, gym_id uuid, gym_name text, fee_cents int,
  online_payments boolean, razorpay_account_id text,
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
           g.online_payments, g.razorpay_account_id,
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
