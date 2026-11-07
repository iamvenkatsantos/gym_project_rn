-- Payment receipts (Venkat, 2026-11-07). Every membership with money paid (front desk or
-- in the app) gets a receipt number, counted per branch from 1, and a receipt with the
-- branch's name and address that the member and the gym's managers can open and share.
-- Not a tax invoice: no GST, no GSTIN.

-- Receipt numbers ---------------------------------------------------------------------------

-- The last number a branch gave out. Not readable by apps (gyms' select is per column).
alter table public.gyms add column last_receipt_no int not null default 0;

alter table public.memberships add column receipt_no int check (receipt_no > 0);

-- Paid means money changed hands: complimentary and zero-amount memberships get no receipt.
create function public.is_paid_membership(p_amount_cents int, p_method text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p_amount_cents, 0) > 0 and p_method is distinct from 'complimentary'
$$;

-- Number every paid membership already recorded, oldest first, per branch.
with numbered as (
  select m.id,
    row_number() over (partition by mp.gym_id order by m.created_at, m.id) as n
  from public.memberships m
  join public.membership_plans mp on mp.id = m.plan_id
  where public.is_paid_membership(m.amount_paid_cents, m.payment_method)
)
update public.memberships m set receipt_no = numbered.n
from numbered
where numbered.id = m.id;

update public.gyms g set last_receipt_no = counts.last
from (
  select mp.gym_id, max(m.receipt_no) as last
  from public.memberships m
  join public.membership_plans mp on mp.id = m.plan_id
  where m.receipt_no is not null
  group by mp.gym_id
) counts
where counts.gym_id = g.id;

-- Gives a paid membership the branch's next number, once. Nobody sets or changes it by hand.
-- Locking the gym's row makes two payments at the same moment wait for each other.
create function public.number_receipt() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_gym uuid;
begin
  if tg_op = 'UPDATE' and old.receipt_no is not null then
    new.receipt_no := old.receipt_no;
    return new;
  end if;
  new.receipt_no := null;
  if not public.is_paid_membership(new.amount_paid_cents, new.payment_method) then
    return new;
  end if;
  select gym_id into v_gym from public.membership_plans where id = new.plan_id;
  update public.gyms set last_receipt_no = last_receipt_no + 1
  where id = v_gym
  returning last_receipt_no into new.receipt_no;
  return new;
end;
$$;

create trigger memberships_number_receipt
  before insert or update on public.memberships
  for each row execute function public.number_receipt();

-- The receipt -------------------------------------------------------------------------------

-- Everything a receipt shows, for the member who paid or the branch's owners and supervisors.
-- Null when the membership isn't theirs to see or nothing was paid.
create function public.membership_receipt(p_membership_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_m public.memberships;
  v_plan public.membership_plans;
  v_gym public.gyms;
  v_result jsonb;
begin
  select * into v_m from public.memberships where id = p_membership_id;
  if not found or v_m.receipt_no is null then
    return null;
  end if;
  select * into v_plan from public.membership_plans where id = v_m.plan_id;
  if v_m.member_id is distinct from auth.uid()
     and not public.has_gym_role(v_plan.gym_id, array['supervisor']) then
    return null;
  end if;
  select * into v_gym from public.gyms where id = v_plan.gym_id;

  select jsonb_build_object(
    'membership_id', v_m.id,
    'receipt_no', v_m.receipt_no,
    'gym_name', v_gym.name,
    'brand_name', coalesce((select b.name from public.brands b where b.id = v_gym.brand_id), ''),
    'address', coalesce(v_gym.address, ''),
    'city', coalesce(v_gym.city, ''),
    'phone', coalesce(v_gym.phone, ''),
    'email', coalesce(v_gym.email, ''),
    'member_name', coalesce((select p.full_name from public.profiles p where p.id = v_m.member_id), ''),
    'member_phone', (select c.phone from public.contact_details c where c.user_id = v_m.member_id),
    'plan_name', v_plan.name,
    'starts_on', v_m.starts_on,
    'ends_on', v_m.ends_on,
    'amount_cents', v_m.amount_paid_cents,
    'currency', v_plan.currency,
    'payment_method', v_m.payment_method,
    'paid_at', coalesce(
      (select o.paid_at from public.online_payments o where o.membership_id = v_m.id limit 1),
      v_m.created_at),
    'reference', (select o.razorpay_payment_id from public.online_payments o
                  where o.membership_id = v_m.id limit 1),
    'received_by', case when v_m.payment_method = 'online' then null
      else (select nullif(p.full_name, '') from public.profiles p where p.id = v_m.recorded_by) end
  ) into v_result;
  return v_result;
end;
$$;

revoke execute on function public.membership_receipt(uuid) from public, anon;
grant execute on function public.membership_receipt(uuid) to authenticated;
