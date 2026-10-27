-- A simple view for CoreFit Gym's admin: owners, their brands and branches,
-- and what to collect from each. CoreFit Gym bills a monthly fee per branch.
-- The fee is set once for everyone, and a brand can have its own deal.

create table public.platform_settings (
  id boolean primary key default true check (id),
  branch_fee_cents int not null default 0 check (branch_fee_cents between 0 and 100000000),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  updated_at timestamptz not null default now()
);

insert into public.platform_settings default values;

alter table public.platform_settings enable row level security;

create policy "Admins read platform settings" on public.platform_settings
  for select using (public.is_platform_admin());

revoke insert, update, delete on public.platform_settings from authenticated, anon;

-- A brand's own monthly fee per branch; null means the standard fee.
alter table public.brands
  add column branch_fee_cents int check (branch_fee_cents between 0 and 100000000);

-- Admins only. The standard monthly fee per branch.
create function public.admin_set_branch_fee(p_fee_cents int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only CoreFit Gym admins set the branch fee';
  end if;
  if p_fee_cents is null or p_fee_cents not between 0 and 100000000 then
    raise exception 'Enter a fee of 0 or more';
  end if;
  update public.platform_settings set branch_fee_cents = p_fee_cents, updated_at = now();
end;
$$;

revoke execute on function public.admin_set_branch_fee(int) from public, anon;
grant execute on function public.admin_set_branch_fee(int) to authenticated;

-- Admins only. A brand's own fee per branch, or null for the standard fee.
create function public.admin_set_brand_fee(p_brand_id uuid, p_fee_cents int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only CoreFit Gym admins set a brand''s fee';
  end if;
  if p_fee_cents is not null and p_fee_cents not between 0 and 100000000 then
    raise exception 'Enter a fee of 0 or more';
  end if;
  update public.brands set branch_fee_cents = p_fee_cents where id = p_brand_id;
  if not found then
    raise exception 'That brand doesn''t exist';
  end if;
end;
$$;

revoke execute on function public.admin_set_brand_fee(uuid, int) from public, anon;
grant execute on function public.admin_set_brand_fee(uuid, int) to authenticated;

-- Every branch with what the admin needs to visit it and bill it: contact
-- details, owners ({id, full_name, email}), how many members and staff it has,
-- and the brand's own fee (null for the standard one).
drop function public.admin_branches();

create function public.admin_branches()
returns table (
  brand_id uuid, brand_name text, brand_fee_cents int, gym_id uuid, gym_name text,
  address text, city text, phone text, email text,
  owners jsonb, members int, staff int, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only CoreFit Gym admins see every branch';
  end if;
  return query
    select b.id, b.name, b.branch_fee_cents, g.id, g.name,
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
