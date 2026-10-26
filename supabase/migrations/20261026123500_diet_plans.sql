-- Diet and nutrition plans.
--
-- Coaches (trainers, and owners and supervisors coaching under their own name)
-- write meal plans: daily calorie and macro targets, a food type, notes, and an
-- ordered list of meals. They assign a plan to their mapped members, and each
-- member follows one diet plan at a time at a gym, so assigning a new one
-- replaces the old. Owners and supervisors can read every plan at their gym;
-- members read only the plan they're on.

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  coach_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  title text not null check (length(trim(title)) between 2 and 80),
  notes text not null default '' check (length(notes) <= 1000),
  food_type text not null default 'veg' check (food_type in ('veg', 'egg', 'non_veg', 'vegan')),
  -- Daily targets; null when the coach leaves one open.
  calories int check (calories between 800 and 6000),
  protein_g int check (protein_g between 0 and 500),
  carbs_g int check (carbs_g between 0 and 1000),
  fat_g int check (fat_g between 0 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.meal_plans (gym_id, coach_id);

create table public.meal_plan_meals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.meal_plans (id) on delete cascade,
  position int not null,
  name text not null check (length(trim(name)) between 1 and 40),
  -- Free text such as "7:30 AM" or "After workout".
  time_label text not null default '' check (length(time_label) <= 30),
  foods text not null check (length(trim(foods)) between 1 and 500),
  calories int check (calories between 0 and 3000),
  unique (plan_id, position)
);

create table public.meal_plan_assignments (
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid not null references public.meal_plans (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null default auth.uid(),
  assigned_at timestamptz not null default now(),
  -- One diet plan per member per gym.
  primary key (gym_id, member_id)
);

create index on public.meal_plan_assignments (plan_id);

-- Helpers ---------------------------------------------------------------------------

-- The plan's author while they can still coach, or an owner of its gym.
create function public.can_edit_meal_plan(p_plan_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.meal_plans p
    where p.id = p_plan_id
      and (
        (p.coach_id = auth.uid() and public.has_gym_role(p.gym_id, array['trainer']))
        or public.has_gym_role(p.gym_id, array['owner'])
      )
  )
$$;

-- Its editors, the gym's owners and supervisors, and the members on it.
create function public.can_view_meal_plan(p_plan_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.meal_plans p
    where p.id = p_plan_id
      and (
        public.can_edit_meal_plan(p.id)
        or public.can_manage_gym(p.gym_id)
        or exists (
          select 1 from public.meal_plan_assignments a
          where a.plan_id = p.id and a.member_id = auth.uid()
            and public.has_gym_role(a.gym_id, array['member'])
        )
      )
  )
$$;

-- Policies ----------------------------------------------------------------------------

alter table public.meal_plans enable row level security;
alter table public.meal_plan_meals enable row level security;
alter table public.meal_plan_assignments enable row level security;

-- Spelled out on the row rather than via can_view_meal_plan, so a plan just
-- inserted by save_meal_plan can be returned to its author.
create policy "Read meal plans" on public.meal_plans
  for select using (
    (coach_id = auth.uid() and public.has_gym_role(gym_id, array['trainer']))
    or public.can_manage_gym(gym_id)
    or exists (
      select 1 from public.meal_plan_assignments a
      where a.plan_id = meal_plans.id and a.member_id = auth.uid()
        and public.has_gym_role(a.gym_id, array['member'])
    )
  );
create policy "Coaches write their meal plans" on public.meal_plans
  for insert with check (coach_id = auth.uid() and public.has_gym_role(gym_id, array['trainer']));
create policy "Editors update meal plans" on public.meal_plans
  for update using (public.can_edit_meal_plan(id))
  with check (public.has_gym_role(gym_id, array['trainer']));
create policy "Editors delete meal plans" on public.meal_plans
  for delete using (public.can_edit_meal_plan(id));

-- Columns that never change after a plan is created.
revoke update on public.meal_plans from authenticated;
grant update (title, notes, food_type, calories, protein_g, carbs_g, fat_g, updated_at)
  on public.meal_plans to authenticated;

create policy "Read meals" on public.meal_plan_meals
  for select using (public.can_view_meal_plan(plan_id));
create policy "Editors write meals" on public.meal_plan_meals
  for all using (public.can_edit_meal_plan(plan_id))
  with check (public.can_edit_meal_plan(plan_id));

-- Assignments are written through assign_meal_plan / unassign_meal_plan below.
create policy "Read diet plan assignments" on public.meal_plan_assignments
  for select using (
    member_id = auth.uid() or public.can_manage_gym(gym_id) or public.can_edit_meal_plan(plan_id)
  );

-- Functions --------------------------------------------------------------------------

-- Creates a plan (p_plan_id null) or updates one, replacing its meals, in one
-- transaction. Runs as the caller, so the policies above decide who may write.
-- p_meals is an ordered array of {name, time_label, foods, calories}.
create function public.save_meal_plan(
  p_gym_id uuid,
  p_plan_id uuid,
  p_title text,
  p_notes text,
  p_food_type text,
  p_calories int,
  p_protein_g int,
  p_carbs_g int,
  p_fat_g int,
  p_meals jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
begin
  if jsonb_array_length(coalesce(p_meals, '[]')) = 0 then
    raise exception 'Add at least one meal';
  end if;

  if p_plan_id is null then
    insert into public.meal_plans
      (gym_id, coach_id, title, notes, food_type, calories, protein_g, carbs_g, fat_g)
    values
      (p_gym_id, auth.uid(), trim(p_title), trim(coalesce(p_notes, '')), p_food_type,
       p_calories, p_protein_g, p_carbs_g, p_fat_g)
    returning id into v_id;
  else
    update public.meal_plans
      set title = trim(p_title), notes = trim(coalesce(p_notes, '')), food_type = p_food_type,
          calories = p_calories, protein_g = p_protein_g, carbs_g = p_carbs_g, fat_g = p_fat_g,
          updated_at = now()
      where id = p_plan_id and gym_id = p_gym_id
      returning id into v_id;
    if v_id is null then
      raise exception 'Plan not found';
    end if;
    delete from public.meal_plan_meals where plan_id = v_id;
  end if;

  insert into public.meal_plan_meals (plan_id, position, name, time_label, foods, calories)
  select v_id, t.ord::int, trim(m ->> 'name'), trim(coalesce(m ->> 'time_label', '')),
         trim(m ->> 'foods'), (m ->> 'calories')::int
  from jsonb_array_elements(p_meals) with ordinality as t(m, ord);

  return v_id;
end;
$$;

revoke execute on function public.save_meal_plan(uuid, uuid, text, text, text, int, int, int, int, jsonb) from public, anon;
grant execute on function public.save_meal_plan(uuid, uuid, text, text, text, int, int, int, int, jsonb) to authenticated;

-- Puts a member on a plan, replacing the diet plan they had at this gym, and
-- tells them. The member must be mapped to the plan's coach; owners and
-- supervisors map a member to themselves first from the app, as for workouts.
create function public.assign_meal_plan(p_plan_id uuid, p_member_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.meal_plans;
  v_coach text;
begin
  select * into v_plan from public.meal_plans where id = p_plan_id;
  if not found or not public.can_edit_meal_plan(p_plan_id) then
    raise exception 'Plan not found';
  end if;
  if not exists (
    select 1 from public.member_trainers
    where gym_id = v_plan.gym_id and member_id = p_member_id and trainer_id = v_plan.coach_id
  ) then
    raise exception 'Pick a member this plan''s coach trains';
  end if;

  insert into public.meal_plan_assignments (gym_id, member_id, plan_id, assigned_by, assigned_at)
  values (v_plan.gym_id, p_member_id, p_plan_id, auth.uid(), now())
  on conflict (gym_id, member_id) do update
    set plan_id = excluded.plan_id, assigned_by = excluded.assigned_by,
        assigned_at = excluded.assigned_at
    where meal_plan_assignments.plan_id <> excluded.plan_id;

  if found then
    select full_name into v_coach from public.profiles where id = v_plan.coach_id;
    perform public.notify(v_plan.gym_id, p_member_id, 'trainer_assigned', 'New diet plan',
      coalesce(v_coach, 'Your trainer') || ' gave you a diet plan: ' || v_plan.title
        || '. Find it under Workouts → Diet.');
  end if;
end;
$$;

revoke execute on function public.assign_meal_plan(uuid, uuid) from public, anon;
grant execute on function public.assign_meal_plan(uuid, uuid) to authenticated;

create function public.unassign_meal_plan(p_plan_id uuid, p_member_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_edit_meal_plan(p_plan_id) then
    raise exception 'Plan not found';
  end if;
  delete from public.meal_plan_assignments where plan_id = p_plan_id and member_id = p_member_id;
end;
$$;

revoke execute on function public.unassign_meal_plan(uuid, uuid) from public, anon;
grant execute on function public.unassign_meal_plan(uuid, uuid) to authenticated;

-- Unmapping a coach takes their diet plan off the member too, as with workouts.
create function public.unassign_coach_meal_plans() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.meal_plan_assignments a
    using public.meal_plans p
    where p.id = a.plan_id and a.gym_id = old.gym_id and a.member_id = old.member_id
      and p.coach_id = old.trainer_id;
  return old;
end;
$$;

create trigger member_trainers_unassign_meal_plans
  after delete on public.member_trainers
  for each row execute function public.unassign_coach_meal_plans();
