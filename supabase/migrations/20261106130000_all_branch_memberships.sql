-- Memberships that work at every branch of the brand (Venkat, 2026-11-06).
--
-- An owner marks a plan "All branches". A member on such a plan stays a member of their home
-- branch (where they paid; the money still goes to that branch's own Razorpay account), and
-- can also scan the QR at any other branch of the same brand to check in there as a visitor.
-- While they're in at another branch they can start workouts as usual; the visit shows on that
-- branch's attendance with their home branch's name. Classes and trainer bookings stay at the
-- home branch.

alter table public.membership_plans
  add column all_branches boolean not null default false;

-- Whether two gyms are branches of the same brand.
create function public.same_brand(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.gyms a join public.gyms b on b.brand_id = a.brand_id
    where a.id = p_a and b.id = p_b
  )
$$;
revoke execute on function public.same_brand(uuid, uuid) from public, anon, authenticated;

-- The user's home branch when they may visit this one: another branch of the same brand where
-- they're an active member with an all-branches membership covering today. Null otherwise.
create function public.branch_pass_home(p_gym_id uuid, p_user_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select gm.gym_id
  from public.gyms here
  join public.gyms g on g.brand_id = here.brand_id and g.id <> here.id
  join public.gym_members gm
    on gm.gym_id = g.id and gm.user_id = p_user_id and gm.role = 'member' and gm.status = 'active'
  where here.id = p_gym_id
    and exists (
      select 1 from public.memberships m
      join public.membership_plans mp on mp.id = m.plan_id
      where m.member_id = p_user_id and mp.gym_id = g.id and mp.all_branches
        and m.starts_on <= public.gym_day(p_gym_id) and m.ends_on >= public.gym_day(p_gym_id)
    )
  order by g.name
  limit 1
$$;
revoke execute on function public.branch_pass_home(uuid, uuid) from public, anon, authenticated;

-- A membership here, or an all-branches one from another branch of the brand.
create or replace function public.has_current_membership(p_gym_id uuid, p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    join public.membership_plans mp on mp.id = m.plan_id
    where mp.gym_id = p_gym_id and m.member_id = p_user_id
      and m.starts_on <= public.gym_day(p_gym_id) and m.ends_on >= public.gym_day(p_gym_id)
  ) or public.branch_pass_home(p_gym_id, p_user_id) is not null
$$;

-- A member is in one branch at a time: checking in somewhere closes an open visit at another
-- branch of the brand.
create function public.close_other_branch_visits(p_gym_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.attendance a set checked_out_at = greatest(a.checked_in_at, now())
  where a.user_id = auth.uid() and a.role = 'member' and a.gym_id <> p_gym_id
    and a.checked_out_at is null and public.same_brand(a.gym_id, p_gym_id)
$$;
revoke execute on function public.close_other_branch_visits(uuid) from public, anon, authenticated;

-- Checking in ---------------------------------------------------------------------------

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
  if v_role = 'member' then
    perform public.close_other_branch_visits(p_gym_id);
  end if;
  insert into public.attendance (gym_id, user_id, day, role, checked_in_at, last_check_in_at)
  values (p_gym_id, auth.uid(), public.gym_day(p_gym_id), v_role, now(), now())
  on conflict (gym_id, user_id, day) do update
    set checked_out_at = null, last_check_in_at = now(), auto_checked_out = false
  returning * into v_row;
  return v_row;
end;
$$;

-- Members with an all-branches membership can scan any branch of their brand.
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
    raise exception 'This QR isn''t for a CoreFit branch';
  end if;

  select gm.role into v_role from public.gym_members gm
  where gm.gym_id = p_gym_id and gm.user_id = auth.uid() and gm.status = 'active';
  if v_role in ('owner', 'supervisor') then
    raise exception 'Owners and supervisors don''t check in';
  end if;
  if v_role is null then
    if public.branch_pass_home(p_gym_id, auth.uid()) is not null
       or exists (
         -- Already in on a visit: scanning out never needs a membership.
         select 1 from public.attendance a
         where a.gym_id = p_gym_id and a.user_id = auth.uid() and a.role = 'member'
           and a.day = public.gym_day(p_gym_id) and a.checked_out_at is null
       ) then
      v_role := 'member';
    else
      select g.name into v_home
      from public.gym_members gm
      join public.gyms g on g.id = gm.gym_id
      where gm.user_id = auth.uid() and gm.status = 'active' and public.same_brand(g.id, p_gym_id)
      order by g.name
      limit 1;
      if v_home is not null then
        raise exception 'This QR is for %. Your plan works at % only.', v_gym, v_home;
      end if;
      raise exception 'You aren''t a member of %', v_gym;
    end if;
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
    if v_role = 'member' then
      perform public.close_other_branch_visits(p_gym_id);
    end if;
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

-- Checking out from Home also ends a visit at another branch.
create or replace function public.check_out(p_gym_id uuid) returns public.attendance
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.attendance;
begin
  update public.attendance set checked_out_at = now()
  where gym_id = p_gym_id and user_id = auth.uid() and day = public.gym_day(p_gym_id)
    and checked_out_at is null
  returning * into v_row;
  if v_row is null then
    update public.attendance a set checked_out_at = greatest(a.checked_in_at, now())
    where (a.gym_id, a.user_id, a.day) = (
      select v.gym_id, v.user_id, v.day from public.attendance v
      where v.user_id = auth.uid() and v.role = 'member' and v.gym_id <> p_gym_id
        and v.checked_out_at is null and v.day = public.gym_day(v.gym_id)
        and public.same_brand(v.gym_id, p_gym_id)
      order by v.checked_in_at desc
      limit 1
    )
    returning * into v_row;
  end if;
  if v_row is null then
    raise exception 'Check in first';
  end if;
  return v_row;
end;
$$;

-- Reading -------------------------------------------------------------------------------

-- The caller's day today: their row at this branch, or for members a visit to another branch
-- of the brand. An open visit comes first, then this branch.
create or replace function public.my_attendance(p_gym_id uuid) returns setof public.attendance
language sql stable security definer set search_path = '' as $$
  select a.* from public.attendance a
  where a.user_id = auth.uid()
    and (
      (a.gym_id = p_gym_id and a.day = public.gym_day(p_gym_id))
      or (a.gym_id <> p_gym_id and a.role = 'member' and a.day = public.gym_day(a.gym_id)
          and public.has_gym_role(p_gym_id, array['member'])
          and public.same_brand(a.gym_id, p_gym_id))
    )
  order by (a.checked_out_at is null) desc, (a.gym_id = p_gym_id) desc,
           coalesce(a.last_check_in_at, a.checked_in_at) desc
  limit 1
$$;

-- The same, with the branch's name, so Home can say where they're checked in.
create function public.my_attendance_today(p_gym_id uuid)
returns table (
  gym_id uuid, gym_name text, day date, role text, checked_in_at timestamptz,
  checked_out_at timestamptz, workouts int, auto_checked_out boolean
)
language sql stable security definer set search_path = '' as $$
  select a.gym_id, g.name, a.day, a.role, a.checked_in_at, a.checked_out_at, a.workouts,
         a.auto_checked_out
  from public.my_attendance(p_gym_id) a
  join public.gyms g on g.id = a.gym_id
$$;
revoke execute on function public.my_attendance_today(uuid) from public, anon;
grant execute on function public.my_attendance_today(uuid) to authenticated;

-- Visitors from other branches show on the day's list, with their home branch.
drop function public.gym_attendance(uuid, int);

create function public.gym_attendance(p_gym_id uuid, p_days_ago int default 0)
returns table (
  day date, user_id uuid, full_name text, role text,
  checked_in_at timestamptz, checked_out_at timestamptz, workouts int, auto_checked_out boolean,
  home_branch text
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_day date := public.gym_day(p_gym_id) - greatest(p_days_ago, 0);
begin
  if not public.can_manage_gym(p_gym_id) then
    raise exception 'Only owners and supervisors see attendance';
  end if;
  return query
    select v_day, gm.user_id, p.full_name, gm.role,
           a.checked_in_at, a.checked_out_at, coalesce(a.workouts, 0),
           coalesce(a.auto_checked_out, false), null::text
    from public.gym_members gm
    join public.profiles p on p.id = gm.user_id
    left join public.attendance a
      on a.gym_id = gm.gym_id and a.user_id = gm.user_id and a.day = v_day
    where gm.gym_id = p_gym_id and gm.status = 'active' and gm.role in ('member', 'trainer')
    union all
    select v_day, a.user_id, p.full_name, a.role,
           a.checked_in_at, a.checked_out_at, a.workouts, a.auto_checked_out,
           coalesce((
             select g.name from public.gym_members hm
             join public.gyms g on g.id = hm.gym_id
             where hm.user_id = a.user_id and hm.role = 'member' and hm.gym_id <> p_gym_id
               and public.same_brand(hm.gym_id, p_gym_id)
             order by (hm.status = 'active') desc, g.name
             limit 1
           ), 'Another branch')
    from public.attendance a
    join public.profiles p on p.id = a.user_id
    where a.gym_id = p_gym_id and a.day = v_day
      and not exists (
        select 1 from public.gym_members gm
        where gm.gym_id = p_gym_id and gm.user_id = a.user_id and gm.status = 'active'
          and gm.role in ('member', 'trainer')
      )
    order by 4 desc, 5 nulls last, 3;
end;
$$;

revoke execute on function public.gym_attendance(uuid, int) from public, anon;
grant execute on function public.gym_attendance(uuid, int) to authenticated;

-- Training ------------------------------------------------------------------------------

-- Checked in here or on a visit to another branch both count.
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
  if not exists (select 1 from public.my_attendance(p_gym_id) a where a.checked_out_at is null) then
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

-- A workout done on a visit counts on that visit's day, not as a day at the home branch.
create or replace function public.record_workout_attendance() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
  v_minutes int := greatest(1, round(extract(epoch from new.completed_at - new.started_at) / 60));
  v_check text := '';
begin
  if not exists (
    select 1 from public.gym_members
    where gym_id = new.gym_id and user_id = new.member_id and role = 'member' and status = 'active'
  ) then
    return new;
  end if;
  update public.attendance a set workouts = a.workouts + 1
  where (a.gym_id, a.user_id, a.day) = (
    select v.gym_id, v.user_id, v.day from public.attendance v
    where v.user_id = new.member_id and v.role = 'member' and v.gym_id <> new.gym_id
      and v.day = public.gym_day(v.gym_id, new.started_at)
      and v.checked_in_at <= new.completed_at
      and public.same_brand(v.gym_id, new.gym_id)
      and not exists (
        select 1 from public.attendance h
        where h.gym_id = new.gym_id and h.user_id = new.member_id
          and h.day = public.gym_day(new.gym_id, new.started_at)
      )
    order by v.checked_in_at desc
    limit 1
  );
  if not found then
    insert into public.attendance (gym_id, user_id, day, role, checked_in_at, checked_out_at, workouts)
    values (new.gym_id, new.member_id, public.gym_day(new.gym_id, new.started_at), 'member',
            new.started_at, new.completed_at, 1)
    on conflict (gym_id, user_id, day) do update
      set workouts = attendance.workouts + 1;
  end if;

  -- Only worth a push while it's news.
  if new.completed_at > now() - interval '12 hours' then
    if new.effort is not null then
      v_check := v_check || ' Effort ' || new.effort || '/10.';
    end if;
    if new.pain is not null then
      v_check := v_check || ' Pain: ' || new.pain || '.';
    end if;
    if new.note is not null then
      v_check := v_check || ' "' || new.note || '"';
    end if;
    select full_name into v_name from public.profiles where id = new.member_id;
    perform public.tell_member_trainers(new.gym_id, new.member_id,
      coalesce(v_name, 'Your member') || ' finished a workout',
      new.title || ' done at ' || public.gym_time(new.gym_id, new.completed_at, 'FMHH12:MI AM')
        || ' (' || v_minutes || ' min).' || v_check,
      'workout-end:' || new.client_id);
  end if;
  return new;
end;
$$;
