-- Opening and closing hours per branch.
--
-- Owners set them next to the auto check-out hours (Check-in QR → Settings).
-- Everyone at the branch reads them: Home shows them. Anyone still checked in
-- when the branch closes is checked out at closing time, or earlier if their
-- role's auto check-out hours run out first. Both null means open all day.
-- A closing time before the opening time means it closes after midnight.

alter table public.gyms
  add column opens_at time,
  add column closes_at time,
  add constraint gyms_hours_check check (
    (opens_at is null) = (closes_at is null) and (opens_at is null or opens_at <> closes_at)
  );

grant select (opens_at, closes_at) on public.gyms to authenticated;

-- Owners: the branch's hours, or null and null for open all day.
create function public.set_gym_hours(p_gym_id uuid, p_opens_at time, p_closes_at time)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_gym_role(p_gym_id, array['owner']) then
    raise exception 'Only owners change opening hours';
  end if;
  if (p_opens_at is null) <> (p_closes_at is null) then
    raise exception 'Set both opening and closing times';
  end if;
  if p_opens_at = p_closes_at then
    raise exception 'Opening and closing times can''t be the same';
  end if;
  update public.gyms
  set opens_at = p_opens_at, closes_at = p_closes_at
  where id = p_gym_id;
end;
$$;

revoke execute on function public.set_gym_hours(uuid, time, time) from public, anon;
grant execute on function public.set_gym_hours(uuid, time, time) to authenticated;

-- The first time the branch closes after p_after, in the branch's time zone.
create function public.next_closing(p_time_zone text, p_closes_at time, p_after timestamptz)
returns timestamptz
language sql stable set search_path = '' as $$
  with today as (
    select (((p_after at time zone p_time_zone)::date + p_closes_at) at time zone p_time_zone) as at
  )
  select case when today.at > p_after then today.at else today.at + interval '1 day' end
  from today
$$;

revoke execute on function public.next_closing(text, time, timestamptz) from public, anon, authenticated;

-- As before, but nobody stays checked in past closing time.
create or replace function public.auto_check_out(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  with due as (
    select a.gym_id, a.user_id, a.day, a.checked_in_at,
           coalesce(a.last_check_in_at, a.checked_in_at) as since,
           -- least() skips the null closing time of a branch open all day.
           least(
             coalesce(a.last_check_in_at, a.checked_in_at) + make_interval(hours =>
               case a.role when 'member' then g.member_auto_out_hours else g.trainer_auto_out_hours end
             ),
             case when g.closes_at is not null then
               public.next_closing(g.time_zone, g.closes_at, coalesce(a.last_check_in_at, a.checked_in_at))
             end
           ) as limit_at
    from public.attendance a
    join public.gyms g on g.id = a.gym_id
    where a.checked_out_at is null
  )
  update public.attendance a
  set checked_out_at = greatest(due.checked_in_at, coalesce(
        (select max(w.completed_at) from public.workout_logs w
         where w.gym_id = due.gym_id and w.member_id = due.user_id
           and w.completed_at between due.since and due.limit_at),
        due.limit_at)),
      auto_checked_out = true
  from due
  where a.gym_id = due.gym_id and a.user_id = due.user_id and a.day = due.day
    and due.limit_at <= p_now;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.auto_check_out(timestamptz) from public, anon, authenticated;
