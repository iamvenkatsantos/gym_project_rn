-- QR check-in per branch.
--
-- Each branch has two QR codes that open corefit://check-in?gym=<id>&code=<code>:
--   * a live code shown on a screen at the front desk (the web dashboard's
--     display page, or a spare phone running the app). It changes every 30
--     seconds, so a photo sent on WhatsApp stops working almost at once;
--   * a printed poster with a fixed code. Simpler, but a photo of it works from
--     anywhere, so the owner can switch it off or reset it.
-- Scanning checks a member or trainer in; scanning again checks them out. The
-- Home button stays as a backup unless the owner makes the branch "QR only".
-- Anyone still checked in hours later is checked out automatically, and the
-- attendance row says so.

-- Settings everyone at the branch may read: the app hides the Check in button
-- when it's QR only, and tells people when they'll be checked out.
alter table public.gyms
  add column qr_check_in_only boolean not null default false,
  add column member_auto_out_hours int not null default 3
    check (member_auto_out_hours between 1 and 12),
  add column trainer_auto_out_hours int not null default 12
    check (trainer_auto_out_hours between 1 and 24);

grant select (qr_check_in_only, member_auto_out_hours, trainer_auto_out_hours)
  on public.gyms to authenticated;

-- The branch's secrets. Only the functions below read or change them.
create table public.gym_check_in_codes (
  gym_id uuid primary key references public.gyms (id) on delete cascade,
  -- Printed on the poster.
  poster_code text not null,
  poster_enabled boolean not null default true,
  -- Opens the live display without signing in, and keys its rotating codes.
  display_key text not null unique,
  updated_at timestamptz not null default now()
);

alter table public.gym_check_in_codes enable row level security;
-- No policies or grants: nobody reads the table directly.
revoke all on public.gym_check_in_codes from anon, authenticated;

alter table public.attendance
  -- When they last came in; checking back in after a break moves it on while
  -- checked_in_at keeps the day's first arrival. Null means checked_in_at.
  add column last_check_in_at timestamptz,
  -- Checked out by auto_check_out() rather than by the person.
  add column auto_checked_out boolean not null default false;

-- Codes -------------------------------------------------------------------------------

-- A hard-to-guess hex string, from two random UUIDs.
create function public.random_check_in_secret(p_length int) returns text
language sql volatile set search_path = '' as $$
  select left(encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')),
                     'hex'), p_length)
$$;

revoke execute on function public.random_check_in_secret(int) from public, anon, authenticated;

-- Live codes last 30 seconds each.
create function public.check_in_window(p_at timestamptz) returns bigint
language sql immutable set search_path = '' as $$
  select floor(extract(epoch from p_at) / 30)::bigint
$$;

-- "<window>.<12 hex>": the window it was shown in, signed with the display key.
create function public.live_check_in_code(p_key text, p_gym_id uuid, p_window bigint) returns text
language sql immutable set search_path = '' as $$
  select p_window || '.' || left(encode(sha256(convert_to(p_key || ':' || p_gym_id || ':' || p_window, 'UTF8')),
                                        'hex'), 12)
$$;

revoke execute on function public.check_in_window(timestamptz) from public, anon, authenticated;
revoke execute on function public.live_check_in_code(text, uuid, bigint) from public, anon, authenticated;

-- The branch's codes, made the first time anyone asks for them.
create function public.ensure_check_in_codes(p_gym_id uuid) returns public.gym_check_in_codes
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.gym_check_in_codes;
begin
  insert into public.gym_check_in_codes (gym_id, poster_code, display_key)
  values (p_gym_id, public.random_check_in_secret(20), public.random_check_in_secret(32))
  on conflict (gym_id) do nothing;
  select * into v_row from public.gym_check_in_codes where gym_id = p_gym_id;
  return v_row;
end;
$$;

revoke execute on function public.ensure_check_in_codes(uuid) from public, anon, authenticated;

-- Whether a scanned code is the branch's poster or a live code from the last
-- minute and a half (the scan, the phone opening the app and signing in can
-- take a while).
create function public.valid_check_in_code(p_gym_id uuid, p_code text, p_now timestamptz default now())
returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_codes public.gym_check_in_codes;
  v_now bigint := public.check_in_window(p_now);
  v_window bigint;
begin
  select * into v_codes from public.gym_check_in_codes where gym_id = p_gym_id;
  if v_codes is null or p_code is null then
    return false;
  end if;
  if v_codes.poster_enabled and p_code = v_codes.poster_code then
    return true;
  end if;
  if p_code !~ '^[0-9]{1,15}\.[0-9a-f]{12}$' then
    return false;
  end if;
  v_window := split_part(p_code, '.', 1)::bigint;
  return v_window between v_now - 2 and v_now
     and p_code = public.live_check_in_code(v_codes.display_key, p_gym_id, v_window);
end;
$$;

revoke execute on function public.valid_check_in_code(uuid, text, timestamptz) from public, anon, authenticated;

-- Owners and supervisors: the branch's QR settings, poster code and display key.
create function public.check_in_qr(p_gym_id uuid)
returns table (
  gym_name text, poster_code text, poster_enabled boolean, display_key text,
  qr_only boolean, member_auto_out_hours int, trainer_auto_out_hours int
)
language plpgsql security definer set search_path = '' as $$
declare
  v_codes public.gym_check_in_codes;
begin
  if not public.can_manage_gym(p_gym_id) then
    raise exception 'Only owners and supervisors see the check-in QR';
  end if;
  v_codes := public.ensure_check_in_codes(p_gym_id);
  return query
    select g.name, v_codes.poster_code, v_codes.poster_enabled, v_codes.display_key,
           g.qr_check_in_only, g.member_auto_out_hours, g.trainer_auto_out_hours
    from public.gyms g where g.id = p_gym_id;
end;
$$;

revoke execute on function public.check_in_qr(uuid) from public, anon;
grant execute on function public.check_in_qr(uuid) to authenticated;

-- The front-desk screen: the current live code for a display key. Works signed
-- out, so the owner never leaves their account open on a shared tablet.
create function public.check_in_display(p_key text)
returns table (gym_id uuid, gym_name text, code text, refresh_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_codes public.gym_check_in_codes;
  v_window bigint := public.check_in_window(now());
begin
  select * into v_codes from public.gym_check_in_codes c where c.display_key = p_key;
  if v_codes is null then
    raise exception 'This display link no longer works. Open the new one from the dashboard.';
  end if;
  return query
    select g.id, g.name, public.live_check_in_code(v_codes.display_key, g.id, v_window),
           to_timestamp((v_window + 1) * 30)
    from public.gyms g where g.id = v_codes.gym_id;
end;
$$;

revoke execute on function public.check_in_display(text) from public;
grant execute on function public.check_in_display(text) to anon, authenticated;

-- Owners: QR only or not, the poster on or off, and when people are checked out.
create function public.set_check_in_settings(
  p_gym_id uuid, p_qr_only boolean, p_poster_enabled boolean,
  p_member_auto_out_hours int, p_trainer_auto_out_hours int
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_gym_role(p_gym_id, array['owner']) then
    raise exception 'Only owners change check-in settings';
  end if;
  if p_member_auto_out_hours not between 1 and 12 then
    raise exception 'Members are checked out after 1 to 12 hours';
  end if;
  if p_trainer_auto_out_hours not between 1 and 24 then
    raise exception 'Trainers are checked out after 1 to 24 hours';
  end if;
  perform public.ensure_check_in_codes(p_gym_id);
  update public.gyms
  set qr_check_in_only = p_qr_only,
      member_auto_out_hours = p_member_auto_out_hours,
      trainer_auto_out_hours = p_trainer_auto_out_hours
  where id = p_gym_id;
  update public.gym_check_in_codes
  set poster_enabled = p_poster_enabled, updated_at = now()
  where gym_id = p_gym_id;
end;
$$;

revoke execute on function public.set_check_in_settings(uuid, boolean, boolean, int, int) from public, anon;
grant execute on function public.set_check_in_settings(uuid, boolean, boolean, int, int) to authenticated;

-- Owners: a new poster code (old posters stop working) or a new display link
-- (old display links stop working).
create function public.reset_check_in_code(p_gym_id uuid, p_which text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_gym_role(p_gym_id, array['owner']) then
    raise exception 'Only owners reset check-in codes';
  end if;
  if p_which not in ('poster', 'display') then
    raise exception 'Pick the poster or the display';
  end if;
  perform public.ensure_check_in_codes(p_gym_id);
  if p_which = 'poster' then
    update public.gym_check_in_codes
    set poster_code = public.random_check_in_secret(20), updated_at = now()
    where gym_id = p_gym_id;
  else
    update public.gym_check_in_codes
    set display_key = public.random_check_in_secret(32), updated_at = now()
    where gym_id = p_gym_id;
  end if;
end;
$$;

revoke execute on function public.reset_check_in_code(uuid, text) from public, anon;
grant execute on function public.reset_check_in_code(uuid, text) to authenticated;

-- Checking in and out -----------------------------------------------------------------

-- The Home button. Same as before, except that a QR-only branch wants a scan,
-- and checking back in records when.
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
  insert into public.attendance (gym_id, user_id, day, role, checked_in_at, last_check_in_at)
  values (p_gym_id, auth.uid(), public.gym_day(p_gym_id), v_role, now(), now())
  on conflict (gym_id, user_id, day) do update
    set checked_out_at = null, last_check_in_at = now(), auto_checked_out = false
  returning * into v_row;
  return v_row;
end;
$$;

-- Scanning a branch's QR. Checks the caller in, or out if they're already in.
-- A second scan within five minutes of checking in is taken as a double scan
-- and changes nothing ('already_in'), so nobody checks out by accident.
create function public.scan_check_in(p_gym_id uuid, p_code text)
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

revoke execute on function public.scan_check_in(uuid, text) from public, anon;
grant execute on function public.scan_check_in(uuid, text) to authenticated;

-- Auto check-out ----------------------------------------------------------------------

-- Checks out everyone still in after the branch's hours for their role, as of
-- their last check-in. A member who finished a workout since is taken to have
-- left when it ended; otherwise they leave at the limit. Returns how many.
create function public.auto_check_out(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  with due as (
    select a.gym_id, a.user_id, a.day, a.checked_in_at,
           coalesce(a.last_check_in_at, a.checked_in_at) as since,
           coalesce(a.last_check_in_at, a.checked_in_at) + make_interval(hours =>
             case a.role when 'member' then g.member_auto_out_hours else g.trainer_auto_out_hours end
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

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('corefit-auto-check-out', '*/10 * * * *', 'select public.auto_check_out()');
  end if;
end;
$$;

-- Reading -----------------------------------------------------------------------------

-- As before, plus whether the check-out was automatic.
drop function public.gym_attendance(uuid, int);

create function public.gym_attendance(p_gym_id uuid, p_days_ago int default 0)
returns table (
  day date, user_id uuid, full_name text, role text,
  checked_in_at timestamptz, checked_out_at timestamptz, workouts int, auto_checked_out boolean
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
           coalesce(a.auto_checked_out, false)
    from public.gym_members gm
    join public.profiles p on p.id = gm.user_id
    left join public.attendance a
      on a.gym_id = gm.gym_id and a.user_id = gm.user_id and a.day = v_day
    where gm.gym_id = p_gym_id and gm.status = 'active' and gm.role in ('member', 'trainer')
    order by gm.role desc, a.checked_in_at nulls last, p.full_name;
end;
$$;

revoke execute on function public.gym_attendance(uuid, int) from public, anon;
grant execute on function public.gym_attendance(uuid, int) to authenticated;

-- The export marks automatic check-outs, e.g. "21:05 (auto)".
create or replace function public.export_attendance(p_gym_id uuid, p_from date, p_to date)
returns table (
  day date, full_name text, role text, checked_in text, checked_out text,
  minutes_in_gym int, workouts int
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.check_report_access(p_gym_id, p_from, p_to);
  return query
    select a.day, p.full_name, a.role,
           public.gym_time(p_gym_id, a.checked_in_at, 'HH24:MI'),
           coalesce(public.gym_time(p_gym_id, a.checked_out_at, 'HH24:MI')
                      || case when a.auto_checked_out then ' (auto)' else '' end, ''),
           round(extract(epoch from a.checked_out_at - a.checked_in_at) / 60)::int,
           a.workouts
    from public.attendance a
    join public.profiles p on p.id = a.user_id
    where a.gym_id = p_gym_id and a.day between p_from and p_to
    order by a.day, a.role desc, a.checked_in_at;
end;
$$;
