-- Fees per branch. The admin sets a default monthly fee; every branch pays it
-- unless the admin gives that branch a fee of its own, higher or lower. A new
-- branch starts at the default, or at a fee the admin enters when adding it.
-- This replaces the per-brand fee from 20261027060000.

-- Supabase refuses an UPDATE without a WHERE clause (pg-safeupdate), so saving
-- the default fee failed with "UPDATE requires a WHERE clause".
create or replace function public.admin_set_branch_fee(p_fee_cents int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only CoreFit Gym admins set the branch fee';
  end if;
  if p_fee_cents is null or p_fee_cents not between 0 and 100000000 then
    raise exception 'Enter a fee of 0 or more';
  end if;
  update public.platform_settings
  set branch_fee_cents = p_fee_cents, updated_at = now()
  where id;
end;
$$;

-- A branch's own monthly fee; null means the default. Owners can't change it:
-- they can only update the gym's name and contact columns.
alter table public.gyms
  add column fee_cents int check (fee_cents between 0 and 100000000);

update public.gyms g
set fee_cents = b.branch_fee_cents
from public.brands b
where b.id = g.brand_id and b.branch_fee_cents is not null;

drop function public.admin_set_brand_fee(uuid, int);

-- admin_branches() returns brand_fee_cents, so it goes before the column.
drop function public.admin_branches();
alter table public.brands drop column branch_fee_cents;

-- Admins only. A branch's own fee, or null to put it back on the default.
create function public.admin_set_gym_fee(p_gym_id uuid, p_fee_cents int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only CoreFit Gym admins set a branch''s fee';
  end if;
  if p_fee_cents is not null and p_fee_cents not between 0 and 100000000 then
    raise exception 'Enter a fee of 0 or more';
  end if;
  update public.gyms set fee_cents = p_fee_cents where id = p_gym_id;
  if not found then
    raise exception 'That branch doesn''t exist';
  end if;
end;
$$;

revoke execute on function public.admin_set_gym_fee(uuid, int) from public, anon;
grant execute on function public.admin_set_gym_fee(uuid, int) to authenticated;

-- Adding a branch can set its fee straight away; null keeps the default.
drop function public.admin_add_branch(uuid, text, text, text, text, text);

create function public.admin_add_branch(
  p_brand_id uuid, p_name text, p_address text, p_city text, p_phone text, p_email text,
  p_fee_cents int default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := trim(p_name);
  v_first uuid;
  v_gym_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Only CoreFit Gym admins can add a branch';
  end if;
  if length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'Enter the branch''s name';
  end if;
  if p_fee_cents is not null and p_fee_cents not between 0 and 100000000 then
    raise exception 'Enter a fee of 0 or more';
  end if;
  select id into v_first from public.gyms
  where brand_id = p_brand_id order by created_at limit 1;
  if v_first is null then
    raise exception 'That brand doesn''t exist';
  end if;

  insert into public.gyms (
    name, address, city, phone, email, created_by, brand_id, time_zone, fee_cents
  )
  select v_name, trim(coalesce(p_address, '')), trim(coalesce(p_city, '')),
         trim(coalesce(p_phone, '')), lower(trim(coalesce(p_email, ''))), auth.uid(),
         p_brand_id, g.time_zone, p_fee_cents
  from public.gyms g where g.id = v_first
  returning id into v_gym_id;

  insert into public.gym_members (gym_id, user_id, role)
  select distinct v_gym_id, gm.user_id, 'owner'
  from public.gym_members gm
  join public.gyms g on g.id = gm.gym_id
  where g.brand_id = p_brand_id and g.id <> v_gym_id
    and gm.role = 'owner' and gm.status = 'active'
  on conflict (gym_id, user_id) do nothing;

  insert into public.membership_plans (gym_id, name, price_cents, currency, duration_days)
  select v_gym_id, mp.name, mp.price_cents, mp.currency, mp.duration_days
  from public.membership_plans mp
  where mp.gym_id = v_first and mp.active;

  return v_gym_id;
end;
$$;

revoke execute on function public.admin_add_branch(uuid, text, text, text, text, text, int)
  from public, anon;
grant execute on function public.admin_add_branch(uuid, text, text, text, text, text, int)
  to authenticated;

-- As before, with each branch's own fee (null for the default) in place of the brand's.
create function public.admin_branches()
returns table (
  brand_id uuid, brand_name text, gym_id uuid, gym_name text, fee_cents int,
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

-- What CoreFit Gym charges a branch is between the admin and the owner, not
-- something members or staff can read off the gym's row. Every other column
-- stays readable as before; admins read fees through admin_branches().
revoke select on public.gyms from anon, authenticated;
grant select (
  id, name, created_at, time_zone, address, city, phone, email, created_by, brand_id
) on public.gyms to authenticated;
