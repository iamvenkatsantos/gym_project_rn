-- Fitness core: exercise library, structured workout plans, workout logging
-- and body measurements.

-- Exercise library. gym_id null = the shared CoreFit library every gym sees.
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms (id) on delete cascade,
  name text not null,
  muscle_groups text[] not null default '{}',
  equipment text not null default 'none',
  difficulty text not null default 'beginner'
    check (difficulty in ('beginner', 'intermediate', 'advanced')),
  instructions text[] not null default '{}',
  safety_tips text[] not null default '{}',
  image_url text,
  video_url text,
  created_at timestamptz not null default now()
);

create index on public.exercises (gym_id);

-- Plans become an ordered list of exercise prescriptions instead of free-form JSON.
alter table public.workouts drop column exercises;

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  position int not null,
  sets int not null check (sets between 1 and 20),
  reps int not null check (reps between 1 and 100),
  target_weight_kg numeric(6, 2),
  rest_seconds int not null default 90 check (rest_seconds between 0 and 600),
  unique (workout_id, position)
);

-- A trainer assigning a plan to a member also lets that trainer see the
-- member's workout logs.
create table public.workout_assignments (
  workout_id uuid not null references public.workouts (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (workout_id, member_id)
);

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  -- Generated on the device so a retried upload of an offline workout is a no-op.
  client_id uuid not null unique,
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  workout_id uuid references public.workouts (id) on delete set null,
  title text not null,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  check (completed_at >= started_at)
);

create index on public.workout_logs (member_id, completed_at desc);

create table public.workout_log_sets (
  log_id uuid not null references public.workout_logs (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  set_number int not null check (set_number > 0),
  reps int not null check (reps >= 0),
  weight_kg numeric(6, 2) check (weight_kg >= 0),
  primary key (log_id, exercise_id, set_number)
);

-- Private by default: only the member reads their own measurements.
create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  measured_at timestamptz not null default now(),
  metric text not null check (metric in ('weight_kg', 'body_fat_pct', 'waist_cm', 'chest_cm')),
  value numeric(6, 2) not null check (value > 0)
);

create index on public.body_measurements (member_id, metric, measured_at desc);

-- Helpers ---------------------------------------------------------------------

create function public.can_view_workout(p_workout_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workouts w where w.id = p_workout_id and public.is_gym_member(w.gym_id)
  )
$$;

create function public.can_edit_workout(p_workout_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workouts w
    where w.id = p_workout_id
      and (
        (w.trainer_id = auth.uid() and public.has_gym_role(w.gym_id, array['trainer']))
        or public.has_gym_role(w.gym_id, array['owner'])
      )
  )
$$;

-- True when the caller trains this member through an assigned plan.
create function public.trains_member(p_member_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workout_assignments a
    join public.workouts w on w.id = a.workout_id
    where a.member_id = p_member_id
      and w.trainer_id = auth.uid()
      and public.has_gym_role(w.gym_id, array['trainer'])
  )
$$;

-- Policies ----------------------------------------------------------------------

alter table public.exercises enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_assignments enable row level security;
alter table public.workout_logs enable row level security;
alter table public.workout_log_sets enable row level security;
alter table public.body_measurements enable row level security;

create policy "Read shared and own-gym exercises" on public.exercises
  for select using (
    gym_id is null and auth.uid() is not null or public.is_gym_member(gym_id)
  );
create policy "Staff manage gym exercises" on public.exercises
  for all using (public.has_gym_role(gym_id, array['trainer', 'owner']))
  with check (public.has_gym_role(gym_id, array['trainer', 'owner']));

create policy "Read plan exercises" on public.workout_exercises
  for select using (public.can_view_workout(workout_id));
create policy "Plan authors edit plan exercises" on public.workout_exercises
  for all using (public.can_edit_workout(workout_id))
  with check (public.can_edit_workout(workout_id));

create policy "Members see their assignments" on public.workout_assignments
  for select using (member_id = auth.uid() or public.can_edit_workout(workout_id));
create policy "Plan authors assign plans" on public.workout_assignments
  for all using (public.can_edit_workout(workout_id))
  with check (
    public.can_edit_workout(workout_id)
    and exists (
      select 1 from public.workouts w
      join public.gym_members gm on gm.gym_id = w.gym_id
      where w.id = workout_id and gm.user_id = member_id and gm.role = 'member'
    )
  );

create policy "Members manage own logs" on public.workout_logs
  for all using (member_id = auth.uid())
  with check (member_id = auth.uid() and public.has_gym_role(gym_id, array['member']));
create policy "Assigned trainers read logs" on public.workout_logs
  for select using (public.trains_member(member_id));

create policy "Members manage own sets" on public.workout_log_sets
  for all using (
    exists (select 1 from public.workout_logs l where l.id = log_id and l.member_id = auth.uid())
  )
  with check (
    exists (select 1 from public.workout_logs l where l.id = log_id and l.member_id = auth.uid())
  );
create policy "Assigned trainers read sets" on public.workout_log_sets
  for select using (
    exists (
      select 1 from public.workout_logs l where l.id = log_id and public.trains_member(l.member_id)
    )
  );

create policy "Members manage own measurements" on public.body_measurements
  for all using (member_id = auth.uid()) with check (member_id = auth.uid());
