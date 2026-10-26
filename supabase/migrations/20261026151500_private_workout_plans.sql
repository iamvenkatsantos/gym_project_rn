-- Workout plans were readable by everyone in the gym. Now a plan is visible to
-- the coach who wrote it, to members coached by that coach or given the plan,
-- and to owners and supervisors, who oversee every plan in the gym.

create or replace function public.can_view_workout(p_workout_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workouts w
    where w.id = p_workout_id
      and (
        (w.trainer_id = auth.uid() and public.is_gym_member(w.gym_id))
        or public.has_gym_role(w.gym_id, array['supervisor'])
        or exists (
          select 1 from public.member_trainers mt
          where mt.gym_id = w.gym_id and mt.trainer_id = w.trainer_id
            and mt.member_id = auth.uid()
        )
        or exists (
          select 1 from public.workout_assignments a
          where a.workout_id = w.id and a.member_id = auth.uid()
        )
      )
  )
$$;

drop policy "Read workouts in your gyms" on public.workouts;
create policy "Read plans you wrote, follow or oversee" on public.workouts
  for select using (public.can_view_workout(id));
