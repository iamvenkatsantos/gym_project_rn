-- Owner Home numbers in one small call (perf audit, 2026-11-17). The dashboard downloaded everyone
-- (gym_people ~137 KB), every membership (~168 KB), today's attendance (~65 KB) and every trainer
-- link (~38 KB) at 300 members only to count them. Same rules as the app's tiles:
--   active_members   latest membership started and not ended on p_today (membershipStatus active
--                    or expiringSoon), like latestByMember + membershipStatus
--   no_trainer       active members with no trainer at this gym (unmappedMembers)
--   birthdays_today  active members whose birthday is the gym's today (upcomingBirthdays(.., 0))
--   members_present, trainers_present, trainers_total   gym_attendance(p_gym_id, 0), countByRole
-- p_today is the phone's date, as the app used for memberships. Owners and supervisors only.
create or replace function public.owner_dashboard_counts(p_gym_id uuid, p_today date)
returns table (
  active_members int, no_trainer int, birthdays_today int,
  members_present int, trainers_present int, trainers_total int
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_manage_gym(p_gym_id) then
    raise exception 'Only owners and supervisors see the dashboard';
  end if;
  return query
    with latest as (
      select distinct on (m.member_id) m.starts_on, m.ends_on
      from public.memberships m
      join public.membership_plans p on p.id = m.plan_id
      where p.gym_id = p_gym_id
      order by m.member_id, m.ends_on desc, m.created_at desc
    ),
    members as (
      select gm.user_id
      from public.gym_members gm
      where gm.gym_id = p_gym_id and gm.role = 'member' and gm.status = 'active'
    ),
    visits as (
      select a.role, a.checked_in_at from public.gym_attendance(p_gym_id, 0) a
    )
    select
      (select count(*) from latest l where l.starts_on <= p_today and l.ends_on >= p_today)::int,
      (select count(*) from members mb
        where not exists (
          select 1 from public.member_trainers mt
          where mt.gym_id = p_gym_id and mt.member_id = mb.user_id
        ))::int,
      (select count(*) from members mb
        join public.contact_details cd on cd.user_id = mb.user_id
        where public.is_birthday(cd.date_of_birth, public.gym_day(p_gym_id)))::int,
      (select count(*) from visits d where d.role = 'member' and d.checked_in_at is not null)::int,
      (select count(*) from visits d where d.role = 'trainer' and d.checked_in_at is not null)::int,
      (select count(*) from visits d where d.role = 'trainer')::int;
end;
$$;

revoke execute on function public.owner_dashboard_counts(uuid, date) from public, anon;
grant execute on function public.owner_dashboard_counts(uuid, date) to authenticated;
