-- Trainer tools: a plan builder that saves plans atomically, plan assignment,
-- and trainers editing their own weekly availability.

alter table public.workouts
  add constraint workouts_title_present check (length(trim(title)) > 0),
  add constraint workouts_duration_range check (duration_minutes between 5 and 300);

-- The workout session and log sets are keyed by exercise, so a plan lists each exercise once.
alter table public.workout_exercises
  add constraint workout_exercises_once_per_plan unique (workout_id, exercise_id);

-- Plans may only use shared exercises or ones from the plan's own gym.
drop policy "Plan authors edit plan exercises" on public.workout_exercises;
create policy "Plan authors edit plan exercises" on public.workout_exercises
  for all using (public.can_edit_workout(workout_id))
  with check (
    public.can_edit_workout(workout_id)
    and exists (
      select 1 from public.exercises x
      join public.workouts w on w.id = workout_id
      where x.id = exercise_id and (x.gym_id is null or x.gym_id = w.gym_id)
    )
  );

alter table public.workout_assignments alter column assigned_by set default auth.uid();

-- Creates or updates a plan and replaces its exercises in one transaction.
-- Runs as the caller, so the workouts and workout_exercises policies decide
-- who may write. p_exercises is an ordered array of
-- {exercise_id, sets, reps, target_weight_kg, rest_seconds}.
create function public.save_workout(
  p_gym_id uuid,
  p_workout_id uuid,
  p_title text,
  p_description text,
  p_level text,
  p_duration_minutes int,
  p_exercises jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
begin
  if jsonb_array_length(p_exercises) = 0 then
    raise exception 'Add at least one exercise';
  end if;

  if p_workout_id is null then
    insert into public.workouts (gym_id, trainer_id, title, description, level, duration_minutes)
    values (p_gym_id, auth.uid(), trim(p_title), p_description, p_level, p_duration_minutes)
    returning id into v_id;
  else
    update public.workouts
      set title = trim(p_title), description = p_description, level = p_level,
          duration_minutes = p_duration_minutes
      where id = p_workout_id and gym_id = p_gym_id
      returning id into v_id;
    if v_id is null then
      raise exception 'Plan not found';
    end if;
    delete from public.workout_exercises where workout_id = v_id;
  end if;

  insert into public.workout_exercises
    (workout_id, exercise_id, position, sets, reps, target_weight_kg, rest_seconds)
  select v_id, (e ->> 'exercise_id')::uuid, t.ord::int, (e ->> 'sets')::int, (e ->> 'reps')::int,
         (e ->> 'target_weight_kg')::numeric, (e ->> 'rest_seconds')::int
  from jsonb_array_elements(p_exercises) with ordinality as t(e, ord);

  return v_id;
end;
$$;

revoke execute on function public.save_workout(uuid, uuid, text, text, text, int, jsonb) from public, anon;
grant execute on function public.save_workout(uuid, uuid, text, text, text, int, jsonb) to authenticated;

-- Replaces the caller's weekly availability and session length at one gym.
-- p_windows is an array of {weekday, start_time, end_time} in the gym's local
-- time. Existing bookings are kept even if they fall outside the new hours.
create function public.set_trainer_availability(
  p_gym_id uuid,
  p_session_minutes int,
  p_windows jsonb
) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.has_gym_role(p_gym_id, array['trainer']) then
    raise exception 'Only trainers of this gym can set availability';
  end if;

  insert into public.trainer_profiles (gym_id, trainer_id, session_minutes)
  values (p_gym_id, auth.uid(), p_session_minutes)
  on conflict (gym_id, trainer_id) do update set session_minutes = excluded.session_minutes;

  delete from public.trainer_availability where gym_id = p_gym_id and trainer_id = auth.uid();

  insert into public.trainer_availability (gym_id, trainer_id, weekday, start_time, end_time)
  select p_gym_id, auth.uid(), (w ->> 'weekday')::int, (w ->> 'start_time')::time,
         (w ->> 'end_time')::time
  from jsonb_array_elements(p_windows) as w;

  if exists (
    select 1 from public.trainer_availability a
    join public.trainer_availability b
      on b.gym_id = a.gym_id and b.trainer_id = a.trainer_id and b.weekday = a.weekday
      and b.id <> a.id and a.start_time < b.end_time and b.start_time < a.end_time
    where a.gym_id = p_gym_id and a.trainer_id = auth.uid()
  ) then
    raise exception 'Availability windows overlap';
  end if;
end;
$$;

revoke execute on function public.set_trainer_availability(uuid, int, jsonb) from public, anon;
grant execute on function public.set_trainer_availability(uuid, int, jsonb) to authenticated;
