-- Body measurements and progress photos. Members log weight, height, body fat and tape
-- measurements over time, and add progress photos. The people who follow their workouts
-- (can_view_workout_logs: owner everyone, supervisor trainers and members, trainer mapped
-- members) can see them too; only the member adds, changes or deletes them.

-- The first body_measurements table (one row per metric, no gym) was never used by the app.
drop table if exists public.body_measurements;

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric(5, 2) check (weight_kg between 20 and 300),
  height_cm numeric(4, 1) check (height_cm between 100 and 250),
  body_fat_pct numeric(3, 1) check (body_fat_pct between 2 and 70),
  chest_cm numeric(4, 1) check (chest_cm between 30 and 250),
  waist_cm numeric(4, 1) check (waist_cm between 30 and 250),
  hips_cm numeric(4, 1) check (hips_cm between 30 and 250),
  arm_cm numeric(4, 1) check (arm_cm between 10 and 100),
  thigh_cm numeric(4, 1) check (thigh_cm between 20 and 150),
  note text check (char_length(note) <= 200),
  updated_at timestamptz not null default now(),
  -- One entry a day; logging again the same day updates it.
  unique (gym_id, member_id, measured_on),
  check (
    num_nonnulls(weight_kg, height_cm, body_fat_pct, chest_cm, waist_cm, hips_cm, arm_cm, thigh_cm) > 0
  ),
  check (measured_on <= current_date + 1)
);

create index on public.body_measurements (gym_id, member_id, measured_on desc);

alter table public.body_measurements enable row level security;

create policy "Log your own measurements" on public.body_measurements
  for all using (member_id = auth.uid())
  with check (member_id = auth.uid() and public.is_gym_member(gym_id));
create policy "Read measurements by role" on public.body_measurements
  for select using (public.can_view_workout_logs(gym_id, member_id));

-- Progress photos -----------------------------------------------------------------
-- Files live in the private progress-photos bucket at <gym_id>/<member_id>/<photo_id>.jpg.

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  pose text not null default 'front' check (pose in ('front', 'side', 'back')),
  taken_on date not null default current_date,
  created_at timestamptz not null default now(),
  check (storage_path like gym_id::text || '/' || member_id::text || '/%')
);

create index on public.progress_photos (gym_id, member_id, taken_on desc);

alter table public.progress_photos enable row level security;

create policy "Add your own photos" on public.progress_photos
  for insert with check (member_id = auth.uid() and public.is_gym_member(gym_id));
create policy "Delete your own photos" on public.progress_photos
  for delete using (member_id = auth.uid());
create policy "Read photos by role" on public.progress_photos
  for select using (public.can_view_workout_logs(gym_id, member_id));

-- The n-th folder of a storage path as a uuid, or null when it isn't one, so policies
-- never fail on files in other buckets that use a different layout.
create function public.storage_path_uuid(p_name text, p_index int) returns uuid
language sql immutable set search_path = '' as $$
  select case when part ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then part::uuid end
  from (select (string_to_array(p_name, '/'))[p_index] as part) as s
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'progress-photos', 'progress-photos', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

create policy "Members upload their progress photos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'progress-photos'
    and public.storage_path_uuid(name, 2) = auth.uid()
    and public.is_gym_member(public.storage_path_uuid(name, 1))
  );
create policy "Members delete their progress photos" on storage.objects
  for delete to authenticated using (
    bucket_id = 'progress-photos' and public.storage_path_uuid(name, 2) = auth.uid()
  );
create policy "Progress photos are read by role" on storage.objects
  for select to authenticated using (
    bucket_id = 'progress-photos'
    and public.can_view_workout_logs(
      public.storage_path_uuid(name, 1), public.storage_path_uuid(name, 2)
    )
  );
