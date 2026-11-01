-- Workout plans by weekday, with catch-up days for a missed workout.
--
-- A coach picks the days a member does each assigned plan (ISO weekdays,
-- 1 = Monday ... 7 = Sunday). No days means any day, as before. A plan whose
-- day was missed stays open for the gym's catch-up days (0 to 3, default 1),
-- unless the member already did it. The app works out what's due today.

alter table public.workout_assignments
  add column days smallint[] not null default '{}';

alter table public.workout_assignments
  add constraint workout_assignments_days_valid
  check (days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[] and cardinality(days) <= 7);

alter table public.gyms
  add column workout_catch_up_days smallint not null default 1;

alter table public.gyms
  add constraint gyms_workout_catch_up_days_range
  check (workout_catch_up_days between 0 and 3);

grant select (workout_catch_up_days) on public.gyms to authenticated;

-- Owners and supervisors: how many days a missed workout stays open.
create function public.set_workout_catch_up_days(p_gym_id uuid, p_days int)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_gym(p_gym_id) then
    raise exception 'Only owners and supervisors change catch-up days';
  end if;
  if p_days is null or p_days < 0 or p_days > 3 then
    raise exception 'Catch-up days must be 0 to 3';
  end if;
  update public.gyms set workout_catch_up_days = p_days where id = p_gym_id;
end;
$$;

revoke execute on function public.set_workout_catch_up_days(uuid, int) from public, anon;
grant execute on function public.set_workout_catch_up_days(uuid, int) to authenticated;
