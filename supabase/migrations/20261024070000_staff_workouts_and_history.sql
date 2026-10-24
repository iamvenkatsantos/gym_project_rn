-- Staff workouts and workout history by role.
--
-- Everyone at a gym can log their own workouts, not just members: owners,
-- supervisors and trainers train too. workout_logs.member_id is the person who
-- did the workout, whatever their role.
--
-- Who sees whose history follows the gym's hierarchy:
--   owner       everyone at the gym
--   supervisor  themselves, trainers and members
--   trainer     themselves and the members mapped to them
--   member      themselves

-- True when the caller may read p_user_id's workouts at this gym.
create function public.can_view_workout_logs(p_gym_id uuid, p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_user_id = auth.uid()
    or public.has_gym_role(p_gym_id, array['owner'])
    or (
      public.has_gym_role(p_gym_id, array['supervisor'])
      and exists (
        select 1 from public.gym_members
        where gym_id = p_gym_id and user_id = p_user_id and role in ('member', 'trainer')
      )
    )
    or (
      public.has_gym_role(p_gym_id, array['trainer'])
      and exists (
        select 1 from public.member_trainers
        where gym_id = p_gym_id and member_id = p_user_id and trainer_id = auth.uid()
      )
    )
$$;

drop policy "Members manage own logs" on public.workout_logs;
drop policy "Assigned trainers read logs" on public.workout_logs;
drop policy "Members manage own sets" on public.workout_log_sets;
drop policy "Assigned trainers read sets" on public.workout_log_sets;

create policy "Log your own workouts" on public.workout_logs
  for all using (member_id = auth.uid())
  with check (member_id = auth.uid() and public.is_gym_member(gym_id));
create policy "Read workouts by role" on public.workout_logs
  for select using (public.can_view_workout_logs(gym_id, member_id));

create policy "Log your own sets" on public.workout_log_sets
  for all using (
    exists (select 1 from public.workout_logs l where l.id = log_id and l.member_id = auth.uid())
  )
  with check (
    exists (select 1 from public.workout_logs l where l.id = log_id and l.member_id = auth.uid())
  );
create policy "Read sets by role" on public.workout_log_sets
  for select using (
    exists (
      select 1 from public.workout_logs l
      where l.id = log_id and public.can_view_workout_logs(l.gym_id, l.member_id)
    )
  );

create index on public.workout_logs (gym_id, completed_at desc);
