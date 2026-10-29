-- Gym owners pay CoreFit Gym in the app (Venkat, 2026-10-29). Billing moves from
-- a monthly fee to a yearly one: ₹4,999 a year per branch by default, plus the
-- online payments add-on for branches that have it. The owner pays for a year
-- at a time through a Razorpay Payment Link; this money is CoreFit Gym's own
-- revenue, so it stays in our account (no Route transfer). Paying extends the
-- branch's paid_until by a year. The admin can also record a year paid by
-- cash or bank transfer, or give one free.
--
-- Also: CoreFit Gym's cut of each member online payment goes from 0.25% to 0.5%.

-- Fees are now per year. Existing monthly amounts become yearly ones (× 12)
-- so a branch with its own fee keeps paying the same; the default becomes
-- ₹4,999.
alter table public.platform_settings alter column branch_fee_cents set default 499900;
alter table public.platform_settings alter column online_addon_cents set default 600000;
update public.platform_settings
set branch_fee_cents = 499900,
    online_addon_cents = least(online_addon_cents * 12, 100000000),
    online_cut_bps = 50,
    updated_at = now()
where id;
alter table public.platform_settings alter column online_cut_bps set default 50;

update public.gyms set fee_cents = least(fee_cents * 12, 100000000) where fee_cents is not null;

-- The last day the branch's subscription covers; null until the first payment.
-- Like the fee, owners read it through branch_subscription(), not the row.
alter table public.gyms add column paid_until date;

create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  -- Who paid in the app, or the admin who recorded it by hand.
  paid_by uuid references public.profiles (id) on delete set null,
  -- online: through Razorpay; manual: recorded by the admin (cash, bank, free).
  method text not null default 'online' check (method in ('online', 'manual')),
  -- The branch fee and the add-on at the time, which add up to the amount.
  fee_cents int not null check (fee_cents >= 0),
  addon_cents int not null default 0 check (addon_cents >= 0),
  amount_cents int not null check (amount_cents >= 0),
  currency text not null,
  status text not null default 'created' check (status in ('created', 'paid', 'expired')),
  razorpay_link_id text unique,
  link_url text,
  razorpay_payment_id text unique,
  -- Razorpay's fee with GST, which CoreFit Gym bears.
  razorpay_fee_cents int,
  -- The year it paid for, once paid.
  period_start date,
  period_end date,
  note text check (length(note) <= 200),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  check (method = 'manual' or amount_cents >= 100)
);

create index on public.subscription_payments (gym_id, created_at desc);

alter table public.subscription_payments enable row level security;

create policy "Owners read their branch's subscription payments" on public.subscription_payments
  for select using (public.has_gym_role(gym_id, array['owner']));
create policy "Admins read subscription payments" on public.subscription_payments
  for select using (public.is_platform_admin());

-- Rows only change through the functions below and the edge functions.
revoke insert, update, delete on public.subscription_payments from anon, authenticated;

-- What a branch pays CoreFit Gym for a year: its own fee or the default, plus
-- the add-on when online payments are on.
create function public.branch_yearly_bill(p_gym_id uuid)
returns table (fee_cents int, addon_cents int, amount_cents int, currency text)
language sql stable security definer set search_path = '' as $$
  select coalesce(g.fee_cents, s.branch_fee_cents),
         case when g.online_payments then s.online_addon_cents else 0 end,
         coalesce(g.fee_cents, s.branch_fee_cents)
           + case when g.online_payments then s.online_addon_cents else 0 end,
         s.currency
  from public.gyms g
  cross join public.platform_settings s
  where g.id = p_gym_id and s.id
$$;

revoke execute on function public.branch_yearly_bill(uuid) from public, anon, authenticated;

-- The branch's owners and the admin: the yearly bill and how long it's paid for.
create function public.branch_subscription(p_gym_id uuid)
returns table (
  fee_cents int, addon_cents int, amount_cents int, currency text, paid_until date, today date
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.has_gym_role(p_gym_id, array['owner']) or public.is_platform_admin()) then
    raise exception 'Only the owner sees what this branch pays CoreFit Gym';
  end if;
  return query
    select b.fee_cents, b.addon_cents, b.amount_cents, b.currency, g.paid_until,
           public.gym_day(p_gym_id)
    from public.branch_yearly_bill(p_gym_id) b
    cross join public.gyms g
    where g.id = p_gym_id;
end;
$$;

revoke execute on function public.branch_subscription(uuid) from public, anon;
grant execute on function public.branch_subscription(uuid) to authenticated;

-- An owner starts paying for the branch's next year. Returns the payment's id
-- for the create-subscription-payment edge function, which opens Razorpay's
-- page for it. Only once the current year has 30 days or less left.
create function public.start_subscription_payment(p_gym_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_bill record;
  v_paid_until date;
  v_id uuid;
begin
  if not public.has_gym_role(p_gym_id, array['owner']) then
    raise exception 'Only the owner pays for this branch';
  end if;
  select * into v_bill from public.branch_yearly_bill(p_gym_id);
  if not found then
    raise exception 'That branch doesn''t exist';
  end if;
  if v_bill.amount_cents < 100 then
    raise exception 'Nothing to pay. This branch is free.';
  end if;
  select paid_until into v_paid_until from public.gyms where id = p_gym_id;
  if v_paid_until > public.gym_day(p_gym_id) + 30 then
    raise exception 'Already paid until %. You can renew 30 days before.',
      to_char(v_paid_until, 'DD Mon YYYY');
  end if;
  if (
    select count(*) from public.subscription_payments
    where gym_id = p_gym_id and created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Too many payment attempts. Please try again in an hour.';
  end if;

  insert into public.subscription_payments (
    gym_id, paid_by, fee_cents, addon_cents, amount_cents, currency
  ) values (
    p_gym_id, auth.uid(), v_bill.fee_cents, v_bill.addon_cents, v_bill.amount_cents,
    v_bill.currency
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.start_subscription_payment(uuid) from public, anon;
grant execute on function public.start_subscription_payment(uuid) to authenticated;

-- Internal: marks a payment paid and moves the branch's paid_until on by a
-- year, starting the day after the current year ends (or today if it lapsed),
-- then tells the branch's owners.
create function public.apply_subscription_payment(p_payment_id uuid) returns date
language plpgsql security definer set search_path = '' as $$
declare
  v_pay public.subscription_payments;
  v_today date;
  v_start date;
  v_end date;
begin
  select * into v_pay from public.subscription_payments where id = p_payment_id for update;
  v_today := public.gym_day(v_pay.gym_id);
  select greatest(v_today, coalesce(paid_until + 1, v_today)) into v_start
  from public.gyms where id = v_pay.gym_id for update;
  v_end := (v_start + interval '1 year')::date - 1;

  update public.subscription_payments
  set status = 'paid', period_start = v_start, period_end = v_end, paid_at = now()
  where id = p_payment_id;
  update public.gyms set paid_until = v_end where id = v_pay.gym_id;

  insert into public.notifications (gym_id, recipient_id, kind, title, body, dedupe_key)
  select v_pay.gym_id, gm.user_id, 'membership', 'CoreFit Gym plan renewed',
         left(g.name || ' is paid until ' || to_char(v_end, 'DD Mon YYYY') || '.', 500),
         'subscription:' || p_payment_id
  from public.gym_members gm
  join public.gyms g on g.id = gm.gym_id
  where gm.gym_id = v_pay.gym_id and gm.role = 'owner' and gm.status = 'active'
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

  return v_end;
end;
$$;

revoke execute on function public.apply_subscription_payment(uuid)
  from public, anon, authenticated;

-- Internal: the webhook calls this once Razorpay's signature checks out. Safe
-- to call twice: a paid payment returns the date it paid up to.
create function public.complete_subscription_payment(
  p_payment_id uuid, p_razorpay_payment_id text, p_amount_cents int, p_fee_cents int
) returns date
language plpgsql security definer set search_path = '' as $$
declare
  v_pay public.subscription_payments;
begin
  select * into v_pay from public.subscription_payments where id = p_payment_id for update;
  if not found then
    raise exception 'Unknown subscription payment %', p_payment_id;
  end if;
  if v_pay.status = 'paid' then
    return v_pay.period_end;
  end if;
  if p_amount_cents is distinct from v_pay.amount_cents then
    raise exception 'Paid % but the payment was for %', p_amount_cents, v_pay.amount_cents;
  end if;
  update public.subscription_payments
  set razorpay_payment_id = p_razorpay_payment_id, razorpay_fee_cents = p_fee_cents
  where id = p_payment_id;
  return public.apply_subscription_payment(p_payment_id);
end;
$$;

revoke execute on function public.complete_subscription_payment(uuid, text, int, int)
  from public, anon, authenticated;

-- Admins only: a year paid outside the app (cash, bank transfer) or given
-- free (amount 0). Extends paid_until like an online payment.
create function public.admin_record_subscription(
  p_gym_id uuid, p_amount_cents int, p_note text default null
) returns date
language plpgsql security definer set search_path = '' as $$
declare
  v_bill record;
  v_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Only CoreFit Gym admins record a payment by hand';
  end if;
  if p_amount_cents is null or p_amount_cents not between 0 and 100000000 then
    raise exception 'Enter an amount of 0 or more';
  end if;
  select * into v_bill from public.branch_yearly_bill(p_gym_id);
  if not found then
    raise exception 'That branch doesn''t exist';
  end if;
  insert into public.subscription_payments (
    gym_id, paid_by, method, fee_cents, addon_cents, amount_cents, currency, note
  ) values (
    p_gym_id, auth.uid(), 'manual', v_bill.fee_cents, v_bill.addon_cents, p_amount_cents,
    v_bill.currency, nullif(left(trim(coalesce(p_note, '')), 200), '')
  ) returning id into v_id;
  return public.apply_subscription_payment(v_id);
end;
$$;

revoke execute on function public.admin_record_subscription(uuid, int, text) from public, anon;
grant execute on function public.admin_record_subscription(uuid, int, text) to authenticated;

-- As before, with how long each branch is paid for.
drop function public.admin_branches();

create function public.admin_branches()
returns table (
  brand_id uuid, brand_name text, gym_id uuid, gym_name text, fee_cents int,
  online_payments boolean, razorpay_account_id text, online_fees_on_member boolean,
  paid_until date,
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
           g.paid_until,
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

-- Whether the branch's plan is paid today. A branch with nothing to pay (fee 0,
-- set by the admin) always is.
create function public.branch_is_paid(p_gym_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(g.paid_until >= public.gym_day(g.id), false)
         or (select b.amount_cents < 100 from public.branch_yearly_bill(g.id) b)
  from public.gyms g where g.id = p_gym_id
$$;

revoke execute on function public.branch_is_paid(uuid) from public, anon;
grant execute on function public.branch_is_paid(uuid) to authenticated;

-- Unpaid branches can't add people (Venkat, 2026-10-29): no invites (email or
-- WhatsApp) and no imports, from the owner or any staff. Everything else keeps
-- working. Invites sent while paid can still be accepted: the person joining
-- inserts their own row. The CoreFit Gym admin and service-role code (auth.uid()
-- null) are never blocked.
create function public.require_paid_branch() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_platform_admin() then
    return new;
  end if;
  -- Someone joining with an invite adds their own row. (Nested: plpgsql doesn't
  -- short-circuit, and gym_invites has no user_id.)
  if tg_table_name = 'gym_members' then
    if new.user_id = auth.uid() then
      return new;
    end if;
  end if;
  if not public.branch_is_paid(new.gym_id) then
    raise exception 'CoreFit Gym plan not paid, so no one can be added. The owner can pay from Dashboard → CoreFit plan.';
  end if;
  return new;
end;
$$;

create trigger gym_invites_require_paid_branch
  before insert on public.gym_invites
  for each row execute function public.require_paid_branch();
create trigger gym_members_require_paid_branch
  before insert on public.gym_members
  for each row execute function public.require_paid_branch();

-- Branches that exist today get 30 days to pay before invites stop.
update public.gyms set paid_until = current_date + 30 where paid_until is null;

-- Anyone at the branch: whether its plan is paid, and if not, the day the app
-- stops for everyone there (Venkat, 2026-10-29). Adding people stops on the
-- first unpaid day; everything else gets 5 more days, counted from the day after
-- the paid year ended, or from the day a never-paid branch was set up. The app
-- shows a banner to every role from the first unpaid day and locks itself from
-- locks_on, leaving the owner only the Pay screen.
create function public.branch_access(p_gym_id uuid)
returns table (paid boolean, locks_on date, locked boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_grace constant int := 5;
  v_gym public.gyms;
  v_today date;
begin
  if not (
    public.is_platform_admin() or exists (
      select 1 from public.gym_members
      where gym_id = p_gym_id and user_id = auth.uid() and status = 'active'
    )
  ) then
    raise exception 'Only people at this branch see its plan';
  end if;
  select * into v_gym from public.gyms where id = p_gym_id;
  if not found then
    raise exception 'That branch doesn''t exist';
  end if;
  paid := public.branch_is_paid(p_gym_id);
  if paid then
    locks_on := null;
    locked := false;
  else
    v_today := public.gym_day(p_gym_id);
    locks_on := coalesce(
      v_gym.paid_until + 1, public.gym_day(p_gym_id, v_gym.created_at)
    ) + v_grace;
    locked := v_today >= locks_on;
  end if;
  return next;
end;
$$;

revoke execute on function public.branch_access(uuid) from public, anon;
grant execute on function public.branch_access(uuid) to authenticated;
