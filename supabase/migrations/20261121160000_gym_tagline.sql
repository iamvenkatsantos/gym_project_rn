-- Gym tagline and the logo on receipts (2026-11-21, Venkat, option 2 of gym branding): the platform
-- admin sets a short tagline per branch beside its logo; both show on the launch screen, the branded
-- sign-in and (the logo) on payment receipts. Owners don't set either.

alter table public.gyms
  add column tagline text
  constraint gyms_tagline_check check (tagline is null or char_length(tagline) between 1 and 60);

-- Everyone at the branch reads it with the gym row; writes go only through the function below.
grant select (tagline) on public.gyms to authenticated;

create function public.set_gym_tagline(p_gym_id uuid, p_tagline text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_tagline text := nullif(btrim(p_tagline), '');
begin
  if not public.is_platform_admin() then
    raise exception 'Only the platform admin changes the gym tagline';
  end if;
  if v_tagline is not null and char_length(v_tagline) > 60 then
    raise exception 'The tagline can be 60 characters at most';
  end if;
  update public.gyms set tagline = v_tagline where id = p_gym_id;
end;
$$;

revoke execute on function public.set_gym_tagline(uuid, text) from public, anon;
grant execute on function public.set_gym_tagline(uuid, text) to authenticated;

-- The admin's branch screen reads the current tagline (admins aren't members of the branch).
create function public.admin_gym_tagline(p_gym_id uuid)
returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only the platform admin reads this';
  end if;
  return (select tagline from public.gyms where id = p_gym_id);
end;
$$;

revoke execute on function public.admin_gym_tagline(uuid) from public, anon;
grant execute on function public.admin_gym_tagline(uuid) to authenticated;

-- The receipt also carries the branch's logo path (same answer as before plus one key).
create or replace function public.membership_receipt(p_membership_id uuid) returns jsonb
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
    'logo_path', v_gym.logo_path,
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


-- Grants stay as they were (create or replace keeps them).
