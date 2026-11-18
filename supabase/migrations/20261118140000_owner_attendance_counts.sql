-- Owner Home's "Came today" and "Trainers in" (perf audit, 2026-11-18). Home downloaded today's
-- whole attendance list (gym_attendance, ~65 KB at 300 members) only to count it. This counts
-- the same rows as the app's countByRole(gym_attendance(gym, 0)): members and trainers who
-- checked in today, and trainers on the list. gym_attendance() itself refuses anyone who
-- doesn't manage the gym.
create function public.owner_attendance_counts(p_gym_id uuid)
returns table (members_present int, trainers_present int, trainers_total int)
language sql stable set search_path = '' as $$
  select (count(*) filter (where a.role = 'member' and a.checked_in_at is not null))::int,
         (count(*) filter (where a.role = 'trainer' and a.checked_in_at is not null))::int,
         (count(*) filter (where a.role = 'trainer'))::int
  from public.gym_attendance(p_gym_id, 0) a
$$;

revoke execute on function public.owner_attendance_counts(uuid) from public, anon;
grant execute on function public.owner_attendance_counts(uuid) to authenticated;
