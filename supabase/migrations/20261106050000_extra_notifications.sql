-- More push notifications (Venkat, 2026-11-06). Everything goes through the inbox, so each
-- one is also pushed by the notifications_push trigger. No new notification kinds, so apps
-- already on phones show them with the right icon.
--
-- 1. New workout plan: a coach assigns a plan, the member hears.
-- 2. Payment received: a recorded membership with money paid says how much.
-- 3. We miss you: 7 days since a member's last check-in; their trainers hear too.
-- 4. Class booking cancelled: a member drops out, the class's trainer hears.
-- 5. Birthday wish: already sent by send_birthday_wish (20261031030000).
-- 6. Monthly measurements: a member with nothing logged for 30 days gets a nudge.
-- 7. New member joined: the person who invited them hears (trainers already get "New member"
--    from the mapping, so they're skipped here).

-- 1. New workout plan ------------------------------------------------------------------------

create function public.announce_workout_assignment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_workout public.workouts;
  v_coach text;
begin
  select * into v_workout from public.workouts where id = new.workout_id;
  -- Own plans (self workouts) are the member's own doing.
  if not found or v_workout.is_self or new.member_id = auth.uid() then
    return new;
  end if;
  select full_name into v_coach from public.profiles where id = coalesce(auth.uid(), new.assigned_by);
  perform public.notify(v_workout.gym_id, new.member_id, 'workout', 'New workout plan',
    coalesce(nullif(v_coach, ''), 'Your trainer') || ' gave you ' || v_workout.title
      || '. Find it under Workouts.');
  return new;
end;
$$;

create trigger workout_assignments_announce
  after insert on public.workout_assignments
  for each row execute function public.announce_workout_assignment();

-- 2. Payment received ------------------------------------------------------------------------

-- "₹1,500" style amounts, without paise when they're zero.
create function public.rupees(p_cents int) returns text
language sql immutable set search_path = '' as $$
  select '₹' || regexp_replace(to_char(p_cents / 100.0, 'FM99,99,99,990.00'), '\.00$', '')
$$;

create or replace function public.announce_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.membership_plans;
begin
  select * into v_plan from public.membership_plans where id = new.plan_id;
  if coalesce(new.amount_paid_cents, 0) > 0 and new.payment_method is distinct from 'complimentary' then
    perform public.notify(v_plan.gym_id, new.member_id, 'membership', 'Payment received',
      public.rupees(new.amount_paid_cents) || ' for ' || v_plan.name || '. Active until '
        || to_char(new.ends_on, 'DD Mon YYYY') || '.');
  else
    perform public.notify(v_plan.gym_id, new.member_id, 'membership', 'Membership active',
      v_plan.name || ' runs until ' || to_char(new.ends_on, 'DD Mon YYYY') || '. Thanks for training with us!');
  end if;
  return new;
end;
$$;

-- 4. Class booking cancelled -----------------------------------------------------------------

-- Only a member dropping out themselves; a cancelled class already tells everyone.
create function public.announce_booking_cancelled() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_class public.classes;
  v_member text;
  v_left int;
begin
  if not (old.status = 'booked' and new.status = 'cancelled')
     or auth.uid() is distinct from new.member_id then
    return new;
  end if;
  select * into v_class from public.classes where id = new.class_id;
  if not found or v_class.status <> 'scheduled' or v_class.starts_at <= now()
     or v_class.trainer_id is null then
    return new;
  end if;
  select full_name into v_member from public.profiles where id = new.member_id;
  select count(*) into v_left from public.bookings where class_id = new.class_id and status = 'booked';
  perform public.notify(v_class.gym_id, v_class.trainer_id, 'booking', 'Booking cancelled',
    coalesce(nullif(v_member, ''), 'A member') || ' dropped out of ' || v_class.title || ' on '
      || public.gym_time(v_class.gym_id, v_class.starts_at) || '. ' || v_left || ' booked.',
    v_class.id);
  return new;
end;
$$;

create trigger bookings_announce_cancelled
  after update of status on public.bookings
  for each row execute function public.announce_booking_cancelled();

-- 7. New member joined -----------------------------------------------------------------------

-- claim_gym_invites deletes the invite once the person's account is confirmed and they're in.
-- A withdrawn invite has no confirmed account at the gym behind it, so it says nothing.
create function public.announce_invite_joined() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_name text;
  v_inviter_role text;
begin
  if old.invited_by is null then
    return old;
  end if;
  select u.id into v_user
  from auth.users u
  join public.gym_members gm on gm.user_id = u.id and gm.gym_id = old.gym_id and gm.status = 'active'
  where lower(u.email) = old.email and u.email_confirmed_at is not null
  limit 1;
  if v_user is null or v_user = old.invited_by then
    return old;
  end if;
  select role into v_inviter_role from public.gym_members
    where gym_id = old.gym_id and user_id = old.invited_by;
  -- A trainer's member is mapped to them on joining, which already sends "New member".
  if v_inviter_role = 'trainer' and old.role = 'member' then
    return old;
  end if;
  select full_name into v_name from public.profiles where id = v_user;
  perform public.notify(old.gym_id, old.invited_by, 'trainer_assigned', 'New member joined',
    coalesce(nullif(v_name, ''), split_part(old.email, '@', 1)) || ' joined as '
      || case old.role when 'member' then 'a member' when 'owner' then 'an owner' else 'a ' || old.role end
      || '.');
  return old;
exception when others then
  -- Never block someone joining over a notification.
  raise warning 'join notification skipped: %', sqlerrm;
  return old;
end;
$$;

create trigger gym_invites_announce_joined
  after delete on public.gym_invites
  for each row execute function public.announce_invite_joined();

-- 3 and 6. Daily nudges ----------------------------------------------------------------------

-- Run hourly by pg_cron; each nudge goes out from 10 am gym time and has a dedupe key, so it's
-- sent once. p_now is only there so tests can pick the time.
create function public.send_member_nudges(p_now timestamptz default now()) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- We miss you: last check-in 7 to 13 days ago, still has a membership. Once per absence;
  -- the 13-day cap stops a launch-day burst to everyone who stopped coming long ago.
  with missed as (
    select gm.gym_id, gm.user_id as member_id, last.day as last_day,
           coalesce(nullif(p.full_name, ''), 'A member') as full_name,
           t.today - last.day as days
    from public.gym_members gm
    join public.gyms g on g.id = gm.gym_id
    join public.profiles p on p.id = gm.user_id
    cross join lateral (
      select (p_now at time zone g.time_zone)::date as today,
             extract(hour from p_now at time zone g.time_zone) as local_hour
    ) t
    cross join lateral (
      select max(a.day) as day from public.attendance a
      where a.gym_id = gm.gym_id and a.user_id = gm.user_id
    ) last
    where gm.role = 'member' and gm.status = 'active'
      and t.local_hour >= 10
      and t.today - last.day between 7 and 13
      and exists (
        select 1 from public.memberships m
        join public.membership_plans mp on mp.id = m.plan_id
        where mp.gym_id = gm.gym_id and m.member_id = gm.user_id
          and m.starts_on <= t.today and m.ends_on >= t.today
      )
  ),
  to_members as (
    insert into public.notifications (gym_id, recipient_id, kind, title, body, dedupe_key)
    select gym_id, member_id, 'reminder', 'We miss you',
           'It''s been ' || days || ' days since your last visit. See you at the gym!',
           'missed:' || gym_id || ':' || last_day
    from missed
    on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing
    returning 1
  )
  insert into public.notifications (gym_id, recipient_id, kind, title, body, dedupe_key)
  select m.gym_id, mt.trainer_id, 'attendance', 'Member missing',
         m.full_name || ' hasn''t come in for ' || m.days || ' days.',
         'missed:' || m.member_id || ':' || m.last_day
  from missed m
  join public.member_trainers mt on mt.gym_id = m.gym_id and mt.member_id = m.member_id
  join public.gym_members tm
    on tm.gym_id = m.gym_id and tm.user_id = mt.trainer_id and tm.status = 'active'
  where mt.trainer_id <> m.member_id
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

  -- Measurements: nothing logged at this gym for 30 days (or ever, 30 days after joining).
  -- At most once a calendar month. Imported members who never signed in are skipped.
  insert into public.notifications (gym_id, recipient_id, kind, title, body, dedupe_key)
  select gm.gym_id, gm.user_id, 'reminder', 'Time to measure',
         'Log your weight and measurements under Progress.',
         'measure:' || gm.gym_id || ':' || to_char(t.today, 'YYYY-MM')
  from public.gym_members gm
  join public.gyms g on g.id = gm.gym_id
  cross join lateral (
    select (p_now at time zone g.time_zone)::date as today,
           extract(hour from p_now at time zone g.time_zone) as local_hour
  ) t
  cross join lateral (
    select max(b.measured_on) as day from public.body_measurements b
    where b.gym_id = gm.gym_id and b.member_id = gm.user_id
  ) last
  where gm.role = 'member' and gm.status = 'active' and gm.onboarded_at is not null
    and t.local_hour >= 10
    and coalesce(last.day, (gm.joined_at at time zone g.time_zone)::date) <= t.today - 30
    and exists (
      select 1 from public.memberships m
      join public.membership_plans mp on mp.id = m.plan_id
      where mp.gym_id = gm.gym_id and m.member_id = gm.user_id
        and m.starts_on <= t.today and m.ends_on >= t.today
    )
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
end;
$$;

revoke execute on function public.send_member_nudges(timestamptz) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('corefit-nudges', '15 * * * *', 'select public.send_member_nudges()');
  end if;
end;
$$;
