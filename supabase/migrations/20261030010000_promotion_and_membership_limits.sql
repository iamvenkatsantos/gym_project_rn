-- Three rules from Venkat (2026-10-30):
-- 1. Owners and supervisors can make a member a trainer. It's the one role change a gym can
--    make itself; every other change is still for a CoreFit Gym admin.
-- 2. CoreFit Gym takes no cut of online payments (0%).
-- 3. A member needs a membership covering today to check in, start a workout or book a class
--    or trainer. Staff are never held to this, and checking out always works.

-- No cut -------------------------------------------------------------------------------

alter table public.platform_settings alter column online_cut_bps set default 0;
update public.platform_settings set online_cut_bps = 0, updated_at = now() where id;

-- Member to trainer --------------------------------------------------------------------

-- promote_to_trainer() sets corefit.promoting for its own update; nothing else can.
create or replace function public.lock_gym_member_role() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null and not public.is_platform_admin()
     and not (old.role = 'member' and new.role = 'trainer'
              and coalesce(current_setting('corefit.promoting', true), '') = 'on') then
    raise exception 'A role can''t be changed once it''s given';
  end if;
  return new;
end;
$$;

-- They stop being coached: their trainer links go (which takes those trainers' workout and
-- diet plans off them), and so do any plans or open trainer requests left over. Their
-- workout history, memberships and attendance stay.
create function public.promote_to_trainer(p_gym_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_member public.gym_members;
  v_gym text;
begin
  if not public.has_gym_role(p_gym_id, array['supervisor']) then
    raise exception 'Only owners and supervisors make trainers';
  end if;
  select * into v_member from public.gym_members
  where gym_id = p_gym_id and user_id = p_user_id
  for update;
  if v_member is null or v_member.role <> 'member' then
    raise exception 'Only members can be made trainers';
  end if;
  if v_member.status <> 'active' then
    raise exception 'Reactivate them first';
  end if;

  perform set_config('corefit.promoting', 'on', true);
  update public.gym_members set role = 'trainer'
  where gym_id = p_gym_id and user_id = p_user_id;
  perform set_config('corefit.promoting', '', true);

  delete from public.member_trainers where gym_id = p_gym_id and member_id = p_user_id;
  delete from public.workout_assignments wa
  using public.workouts w
  where w.id = wa.workout_id and w.gym_id = p_gym_id and wa.member_id = p_user_id;
  delete from public.meal_plan_assignments where gym_id = p_gym_id and member_id = p_user_id;
  update public.trainer_requests set status = 'withdrawn'
  where gym_id = p_gym_id and member_id = p_user_id and status = 'pending';

  select name into v_gym from public.gyms where id = p_gym_id;
  perform public.notify(p_gym_id, p_user_id, 'message', 'You''re now a trainer',
    'You''re a trainer at ' || v_gym || '. Set your weekly hours to take bookings.');
end;
$$;
revoke execute on function public.promote_to_trainer(uuid, uuid) from public, anon;
grant execute on function public.promote_to_trainer(uuid, uuid) to authenticated;

-- Membership needed --------------------------------------------------------------------

-- Whether the user has a membership at this gym covering today (the gym's day).
create function public.has_current_membership(p_gym_id uuid, p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    join public.membership_plans mp on mp.id = m.plan_id
    where mp.gym_id = p_gym_id and m.member_id = p_user_id
      and m.starts_on <= public.gym_day(p_gym_id) and m.ends_on >= public.gym_day(p_gym_id)
  )
$$;
revoke execute on function public.has_current_membership(uuid, uuid) from public, anon, authenticated;

-- Raises for a member of this gym without a current membership; staff pass.
create function public.require_membership(p_gym_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.gym_members
    where gym_id = p_gym_id and user_id = auth.uid() and role = 'member'
  ) and not public.has_current_membership(p_gym_id, auth.uid()) then
    raise exception 'No active membership. Renew to continue.';
  end if;
end;
$$;
revoke execute on function public.require_membership(uuid) from public, anon, authenticated;

create or replace function public.check_in(p_gym_id uuid) returns public.attendance
language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_row public.attendance;
begin
  select role into v_role from public.gym_members
  where gym_id = p_gym_id and user_id = auth.uid() and status = 'active' and role in ('member', 'trainer');
  if v_role is null then
    raise exception 'Only members and trainers check in';
  end if;
  if (select qr_check_in_only from public.gyms where id = p_gym_id) then
    raise exception 'Scan the QR at the front desk to check in';
  end if;
  perform public.require_membership(p_gym_id);
  insert into public.attendance (gym_id, user_id, day, role, checked_in_at, last_check_in_at)
  values (p_gym_id, auth.uid(), public.gym_day(p_gym_id), v_role, now(), now())
  on conflict (gym_id, user_id, day) do update
    set checked_out_at = null, last_check_in_at = now(), auto_checked_out = false
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.scan_check_in(p_gym_id uuid, p_code text)
returns table (action text, gym_name text, checked_in_at timestamptz, checked_out_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_gym text;
  v_home text;
  v_row public.attendance;
  v_action text;
begin
  select g.name into v_gym from public.gyms g where g.id = p_gym_id;
  if v_gym is null then
    raise exception 'This QR isn''t for a CoreFit Gym branch';
  end if;

  select gm.role into v_role from public.gym_members gm
  where gm.gym_id = p_gym_id and gm.user_id = auth.uid() and gm.status = 'active';
  if v_role in ('owner', 'supervisor') then
    raise exception 'Owners and supervisors don''t check in';
  end if;
  if v_role is null then
    -- Members check in at their home branch only.
    select g.name into v_home
    from public.gym_members gm
    join public.gyms g on g.id = gm.gym_id
    join public.gyms scanned on scanned.id = p_gym_id
    where gm.user_id = auth.uid() and gm.status = 'active' and g.brand_id = scanned.brand_id
    limit 1;
    if v_home is not null then
      raise exception 'This QR is for %. Check in at %.', v_gym, v_home;
    end if;
    raise exception 'You aren''t a member of %', v_gym;
  end if;

  if not public.valid_check_in_code(p_gym_id, p_code) then
    raise exception 'This QR has expired. Scan the code at the front desk again.';
  end if;

  select * into v_row from public.attendance a
  where a.gym_id = p_gym_id and a.user_id = auth.uid() and a.day = public.gym_day(p_gym_id)
  for update;

  if v_row is null or v_row.checked_out_at is not null then
    -- Only checking in needs a membership; anyone can scan out.
    perform public.require_membership(p_gym_id);
    insert into public.attendance (gym_id, user_id, day, role, checked_in_at, last_check_in_at)
    values (p_gym_id, auth.uid(), public.gym_day(p_gym_id), v_role, now(), now())
    on conflict (gym_id, user_id, day) do update
      set checked_out_at = null, last_check_in_at = now(), auto_checked_out = false
    returning * into v_row;
    v_action := 'in';
  elsif coalesce(v_row.last_check_in_at, v_row.checked_in_at) > now() - interval '5 minutes' then
    v_action := 'already_in';
  else
    update public.attendance a set checked_out_at = now()
    where a.gym_id = p_gym_id and a.user_id = auth.uid() and a.day = v_row.day
    returning * into v_row;
    v_action := 'out';
  end if;

  return query select v_action, v_gym, v_row.checked_in_at, v_row.checked_out_at;
end;
$$;

create or replace function public.start_workout_attendance(p_gym_id uuid, p_client_id uuid, p_title text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  if not public.has_gym_role(p_gym_id, array['member']) then
    return;
  end if;
  perform public.require_membership(p_gym_id);
  if not exists (
    select 1 from public.attendance
    where gym_id = p_gym_id and user_id = auth.uid() and day = public.gym_day(p_gym_id)
      and checked_out_at is null
  ) then
    raise exception 'Check in first';
  end if;

  select full_name into v_name from public.profiles where id = auth.uid();
  perform public.tell_member_trainers(p_gym_id, auth.uid(),
    coalesce(v_name, 'Your member') || ' started a workout',
    coalesce(nullif(trim(p_title), ''), 'A workout') || ' started at '
      || public.gym_time(p_gym_id, now(), 'FMHH12:MI AM') || '.',
    'workout-start:' || p_client_id);
end;
$$;

create or replace function public.book_class(p_class_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_class public.classes;
  v_booked int;
  v_id uuid;
begin
  select * into v_class from public.classes where id = p_class_id for update;
  if not found or not public.is_gym_member(v_class.gym_id) or v_class.status <> 'scheduled' then
    raise exception 'Class not found';
  end if;
  if v_class.starts_at <= now() then
    raise exception 'Class has already started';
  end if;
  perform public.require_membership(v_class.gym_id);

  select count(*) into v_booked from public.bookings
    where class_id = p_class_id and status = 'booked';
  if v_booked >= v_class.capacity then
    raise exception 'Class is full';
  end if;

  insert into public.bookings (class_id, member_id)
  values (p_class_id, auth.uid())
  on conflict (class_id, member_id) do update set status = 'booked'
    where public.bookings.status = 'cancelled'
  returning id into v_id;

  if v_id is null then
    raise exception 'Already booked';
  end if;
  return v_id;
end;
$$;

create or replace function public.book_trainer_session(p_gym_id uuid, p_trainer_id uuid, p_starts_at timestamptz)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_minutes int;
  v_tz text;
  v_local timestamp;
  v_ends_at timestamptz;
  v_id uuid;
begin
  if not public.has_gym_role(p_gym_id, array['member']) then
    raise exception 'Only members of this gym can book trainers';
  end if;
  perform public.require_membership(p_gym_id);
  if p_starts_at <= now() then
    raise exception 'That time has passed';
  end if;

  select tp.session_minutes into v_minutes from public.trainer_profiles tp
    where tp.gym_id = p_gym_id and tp.trainer_id = p_trainer_id;
  if not found then
    raise exception 'Trainer not found';
  end if;

  select g.time_zone into v_tz from public.gyms g where g.id = p_gym_id;
  v_local := p_starts_at at time zone v_tz;
  v_ends_at := p_starts_at + make_interval(mins => v_minutes);

  if not exists (
    select 1 from public.trainer_availability a
    where a.gym_id = p_gym_id and a.trainer_id = p_trainer_id
      and a.weekday = extract(dow from v_local)::int
      and a.start_time <= v_local::time
      and a.end_time >= (v_local + make_interval(mins => v_minutes))::time
  ) then
    raise exception 'Trainer is not available at that time';
  end if;

  begin
    insert into public.trainer_sessions (gym_id, trainer_id, member_id, starts_at, ends_at)
    values (p_gym_id, p_trainer_id, auth.uid(), p_starts_at, v_ends_at)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'That slot was just taken';
  end;
  return v_id;
end;
$$;
