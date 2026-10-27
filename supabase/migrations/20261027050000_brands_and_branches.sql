-- Brands and branches. A brand (say Pulse Fitness) holds one or more branches
-- (Anna Nagar, Velachery). Each branch is still a gym: its own members,
-- trainers, supervisors, plans, payments and attendance, all scoped by the
-- existing RLS. The brand's owners own every branch.
--
-- CoreFit Gym bills per branch, so only a platform admin adds a branch. Owners
-- can't insert gyms (no policy or grant), can't change a gym's brand (column
-- grants) and can't call admin_add_branch().
--
-- Members belong to one branch, their home branch, and check in only there,
-- as before. A plan that works at every branch can come later.

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

alter table public.brands enable row level security;

revoke insert, update, delete on public.brands from authenticated, anon;

alter table public.gyms add column brand_id uuid references public.brands (id) on delete restrict;

-- Every existing gym gets a brand. Gyms one owner set up themselves (before
-- PR #26 owners could add a second gym) share one; the rest get their own.
do $$
declare
  g record;
  v_brand uuid;
begin
  for g in select id, name, created_by from public.gyms order by created_at loop
    v_brand := null;
    if g.created_by is not null
       and not exists (select 1 from public.platform_admins where user_id = g.created_by) then
      select brand_id into v_brand from public.gyms
      where created_by = g.created_by and brand_id is not null
      limit 1;
    end if;
    if v_brand is null then
      insert into public.brands (name) values (left(g.name, 80)) returning id into v_brand;
    end if;
    update public.gyms set brand_id = v_brand where id = g.id;
  end loop;
end;
$$;

alter table public.gyms alter column brand_id set not null;
create index on public.gyms (brand_id);

-- Owners of any branch of the brand.
create function public.is_brand_owner(p_brand_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.gym_members gm
    join public.gyms g on g.id = gm.gym_id
    where g.brand_id = p_brand_id and gm.user_id = auth.uid()
      and gm.role = 'owner' and gm.status = 'active'
  )
$$;

revoke execute on function public.is_brand_owner(uuid) from public, anon;
grant execute on function public.is_brand_owner(uuid) to authenticated;

create policy "Read brands of your gyms" on public.brands
  for select using (
    public.is_platform_admin() or exists (
      select 1 from public.gyms g where g.brand_id = brands.id and public.is_gym_member(g.id)
    )
  );

-- A new owner's first gym starts a brand of its own, named after the gym.
create or replace function public.create_gym(
  p_name text, p_address text, p_city text, p_phone text, p_email text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := trim(p_name);
  v_brand_id uuid;
  v_gym_id uuid;
begin
  if auth.uid() is null or not public.can_set_up_gym() then
    raise exception 'Ask CoreFit Gym for an invite to set up a gym';
  end if;
  if length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'Enter the gym''s name';
  end if;

  insert into public.brands (name) values (v_name) returning id into v_brand_id;

  insert into public.gyms (name, address, city, phone, email, created_by, brand_id)
  values (
    v_name, trim(coalesce(p_address, '')), trim(coalesce(p_city, '')),
    trim(coalesce(p_phone, '')), lower(trim(coalesce(p_email, ''))), auth.uid(), v_brand_id
  )
  returning id into v_gym_id;

  insert into public.gym_members (gym_id, user_id, role)
  values (v_gym_id, auth.uid(), 'owner');

  delete from public.gym_setup_invites
  where email = (select lower(email) from auth.users where id = auth.uid());

  return v_gym_id;
end;
$$;

-- Admins only. Adds a branch to a brand: the brand's owners become its owners,
-- it takes the time zone of the first branch, and it starts with a copy of
-- that branch's active membership plans, which its owner can then reprice.
-- The admin doesn't join the branch. Returns the new gym's id.
create function public.admin_add_branch(
  p_brand_id uuid, p_name text, p_address text, p_city text, p_phone text, p_email text
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
  select id into v_first from public.gyms
  where brand_id = p_brand_id order by created_at limit 1;
  if v_first is null then
    raise exception 'That brand doesn''t exist';
  end if;

  insert into public.gyms (name, address, city, phone, email, created_by, brand_id, time_zone)
  select v_name, trim(coalesce(p_address, '')), trim(coalesce(p_city, '')),
         trim(coalesce(p_phone, '')), lower(trim(coalesce(p_email, ''))), auth.uid(),
         p_brand_id, g.time_zone
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

revoke execute on function public.admin_add_branch(uuid, text, text, text, text, text)
  from public, anon;
grant execute on function public.admin_add_branch(uuid, text, text, text, text, text)
  to authenticated;

create function public.admin_rename_brand(p_brand_id uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := trim(p_name);
begin
  if not public.is_platform_admin() then
    raise exception 'Only CoreFit Gym admins can rename a brand';
  end if;
  if length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'Enter the brand''s name';
  end if;
  update public.brands set name = v_name where id = p_brand_id;
  if not found then
    raise exception 'That brand doesn''t exist';
  end if;
end;
$$;

revoke execute on function public.admin_rename_brand(uuid, text) from public, anon;
grant execute on function public.admin_rename_brand(uuid, text) to authenticated;

-- Admins only: every branch with its brand, owners and member count, for the
-- admin screen and per-branch billing. owners is a JSON array of
-- {id, full_name, email}.
create function public.admin_branches()
returns table (
  brand_id uuid, brand_name text, gym_id uuid, gym_name text, city text,
  owners jsonb, members int, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only CoreFit Gym admins see every branch';
  end if;
  return query
    select b.id, b.name, g.id, g.name, g.city,
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
           g.created_at
    from public.gyms g
    join public.brands b on b.id = g.brand_id
    order by b.name, g.created_at;
end;
$$;

revoke execute on function public.admin_branches() from public, anon;
grant execute on function public.admin_branches() to authenticated;

-- An owner's "All branches" view: each branch of the brand they own, side by
-- side. Branches they don't own are left out. Days are each branch's own.
-- Renewals due match the dashboard: ending within a week or ended in the last
-- 30 days, by each member's latest membership.
create function public.brand_overview(p_brand_id uuid)
returns table (
  gym_id uuid, gym_name text, city text, members int, active_members int,
  renewals_due int, check_ins_today int, revenue_this_month_cents bigint, currency text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_brand_owner(p_brand_id) then
    raise exception 'Only the brand''s owners see all its branches';
  end if;
  return query
    select g.id, g.name, g.city,
           (select count(*)::int from public.gym_members gm
            where gm.gym_id = g.id and gm.role = 'member' and gm.status = 'active'),
           (select count(distinct m.member_id)::int
            from public.memberships m
            join public.membership_plans mp on mp.id = m.plan_id
            join public.gym_members gm on gm.gym_id = g.id and gm.user_id = m.member_id
            where mp.gym_id = g.id and gm.status = 'active' and gm.role = 'member'
              and m.starts_on <= public.gym_day(g.id) and m.ends_on >= public.gym_day(g.id)),
           (select count(*)::int from (
              select m.member_id, max(m.ends_on) as ends_on
              from public.memberships m
              join public.membership_plans mp on mp.id = m.plan_id
              join public.gym_members gm on gm.gym_id = g.id and gm.user_id = m.member_id
              where mp.gym_id = g.id and gm.status = 'active' and gm.role = 'member'
              group by m.member_id
            ) latest
            where latest.ends_on between public.gym_day(g.id) - 30 and public.gym_day(g.id) + 6),
           (select count(*)::int from public.attendance a
            where a.gym_id = g.id and a.role = 'member' and a.day = public.gym_day(g.id)),
           (select coalesce(sum(coalesce(m.amount_paid_cents, mp.price_cents)), 0)::bigint
            from public.memberships m
            join public.membership_plans mp on mp.id = m.plan_id
            where mp.gym_id = g.id
              and date_trunc('month', m.created_at at time zone g.time_zone)
                = date_trunc('month', now() at time zone g.time_zone)),
           coalesce((select max(mp.currency) from public.membership_plans mp
                     where mp.gym_id = g.id), 'INR')
    from public.gyms g
    where g.brand_id = p_brand_id and public.has_gym_role(g.id, array['owner'])
    order by g.created_at;
end;
$$;

revoke execute on function public.brand_overview(uuid) from public, anon;
grant execute on function public.brand_overview(uuid) to authenticated;
