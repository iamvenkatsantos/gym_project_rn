-- Three Cult.fit-style member features. Pausing and referral rewards are off until
-- the owner switches them on; the waitlist works for every class straight away.
--   1. Membership pause: a member (or an owner or supervisor) pauses for some days and
--      the membership ends that much later. No check-in, workouts or bookings while paused.
--   2. Class waitlist and booking cap: a full class takes a waitlist that fills itself when
--      a spot opens; owners can cap how many upcoming classes a member holds at once.
--   3. Referrals: members refer a friend, who lands in Enquiries. When the friend's first
--      paid membership is recorded, the member gets free days on theirs.
-- Owners set the numbers on Payments → Member rules (set_member_rules()).

-- Settings ------------------------------------------------------------------------------

alter table public.gyms
  -- Days a member can pause each membership; 0 = pausing is off.
  add column pause_max_days int not null default 0 check (pause_max_days between 0 and 90),
  -- Free days the referrer gets when a friend joins; 0 = no reward.
  add column referral_reward_days int not null default 0 check (referral_reward_days between 0 and 60),
  -- Upcoming classes (booked or waitlisted) a member can hold at once; null = no cap.
  add column class_booking_cap int check (class_booking_cap between 1 and 20);

grant select (pause_max_days, referral_reward_days, class_booking_cap) on public.gyms to authenticated;

create function public.set_member_rules(
  p_gym_id uuid, p_pause_max_days int, p_referral_reward_days int, p_class_booking_cap int
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_gym_role(p_gym_id, array['owner']) then
    raise exception 'Only owners change member rules';
  end if;
  if coalesce(p_pause_max_days, -1) not between 0 and 90 then
    raise exception 'Pick 0 to 90 pause days';
  end if;
  if coalesce(p_referral_reward_days, -1) not between 0 and 60 then
    raise exception 'Pick 0 to 60 reward days';
  end if;
  if p_class_booking_cap is not null and p_class_booking_cap not between 1 and 20 then
    raise exception 'Pick 1 to 20 classes';
  end if;
  update public.gyms
  set pause_max_days = p_pause_max_days,
      referral_reward_days = p_referral_reward_days,
      class_booking_cap = p_class_booking_cap
  where id = p_gym_id;
end;
$$;

revoke execute on function public.set_member_rules(uuid, int, int, int) from public, anon;
grant execute on function public.set_member_rules(uuid, int, int, int) to authenticated;

-- 1. Membership pause ----------------------------------------------------------------------

create table public.membership_pauses (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships (id) on delete cascade,
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create index on public.membership_pauses (member_id, gym_id, ends_on);
create index on public.membership_pauses (membership_id);

alter table public.membership_pauses enable row level security;

-- Writes go through pause_membership() and end_pause().
create policy "Members read own pauses" on public.membership_pauses
  for select using (member_id = auth.uid());
create policy "Managers read pauses" on public.membership_pauses
  for select using (public.can_manage_gym(gym_id));

-- Whether the member's membership is paused on that day.
create function public.is_paused(p_gym_id uuid, p_user_id uuid, p_day date) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membership_pauses
    where gym_id = p_gym_id and member_id = p_user_id and p_day between starts_on and ends_on
  )
$$;
revoke execute on function public.is_paused(uuid, uuid, date) from public, anon, authenticated;

-- A paused day doesn't count as covered.
create or replace function public.has_current_membership(p_gym_id uuid, p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    join public.membership_plans mp on mp.id = m.plan_id
    where mp.gym_id = p_gym_id and m.member_id = p_user_id
      and m.starts_on <= public.gym_day(p_gym_id) and m.ends_on >= public.gym_day(p_gym_id)
  ) and not public.is_paused(p_gym_id, p_user_id, public.gym_day(p_gym_id))
$$;

create or replace function public.require_membership(p_gym_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.gym_members
    where gym_id = p_gym_id and user_id = auth.uid() and role = 'member'
  ) and not public.has_current_membership(p_gym_id, auth.uid()) then
    if public.is_paused(p_gym_id, auth.uid(), public.gym_day(p_gym_id)) then
      raise exception 'Your membership is paused. Resume it to continue.';
    end if;
    raise exception 'No active membership. Renew to continue.';
  end if;
end;
$$;

-- Moves a member's memberships that start after p_after by p_days (back with a negative
-- number), so an early renewal still follows on from the paused one.
create function public.shift_later_memberships(p_gym_id uuid, p_member_id uuid, p_after date, p_days int)
returns void
language sql security definer set search_path = '' as $$
  update public.memberships m
  set starts_on = m.starts_on + p_days, ends_on = m.ends_on + p_days
  from public.membership_plans mp
  where mp.id = m.plan_id and mp.gym_id = p_gym_id and m.member_id = p_member_id
    and m.starts_on > p_after
$$;
revoke execute on function public.shift_later_memberships(uuid, uuid, date, int) from public, anon, authenticated;

-- The member pauses their own membership, or an owner or supervisor does it for them.
-- One pause at a time, starting today or within 30 days, and at most the gym's
-- pause_max_days per membership in total. Returns the new end date.
create function public.pause_membership(p_gym_id uuid, p_member_id uuid, p_starts_on date, p_days int)
returns date
language plpgsql security definer set search_path = '' as $$
declare
  v_max int;
  v_today date := public.gym_day(p_gym_id);
  v_tz text;
  v_m public.memberships;
  v_used int;
  v_ends date;
  v_last date;
begin
  if p_member_id = auth.uid() then
    if not public.has_gym_role(p_gym_id, array['member']) then
      raise exception 'Only members pause a membership';
    end if;
  elsif not public.can_manage_gym(p_gym_id) then
    raise exception 'Only owners and supervisors pause someone else''s membership';
  end if;

  select pause_max_days, time_zone into v_max, v_tz from public.gyms where id = p_gym_id;
  if coalesce(v_max, 0) = 0 then
    raise exception 'Pausing is off at this gym';
  end if;
  if p_days is null or p_days < 1 then
    raise exception 'Pause for at least 1 day';
  end if;
  if p_starts_on is null or p_starts_on < v_today then
    raise exception 'Pick today or a later day';
  end if;
  if p_starts_on > v_today + 30 then
    raise exception 'Start the pause within 30 days';
  end if;
  if exists (
    select 1 from public.membership_pauses
    where gym_id = p_gym_id and member_id = p_member_id and ends_on >= v_today
  ) then
    raise exception 'A pause is already set. End it first.';
  end if;

  select m.* into v_m
  from public.memberships m
  join public.membership_plans mp on mp.id = m.plan_id
  where mp.gym_id = p_gym_id and m.member_id = p_member_id
    and p_starts_on between m.starts_on and m.ends_on
  order by m.ends_on desc
  limit 1
  for update of m;
  if v_m.id is null then
    raise exception 'No membership on that day';
  end if;

  select coalesce(sum(ends_on - starts_on + 1), 0) into v_used
  from public.membership_pauses where membership_id = v_m.id;
  if v_used + p_days > v_max then
    if v_used >= v_max then
      raise exception 'No pause days left on this membership';
    end if;
    raise exception 'Only % pause days left on this membership', v_max - v_used;
  end if;

  v_last := p_starts_on + p_days - 1;
  perform public.shift_later_memberships(p_gym_id, p_member_id, v_m.ends_on, p_days);
  update public.memberships set ends_on = ends_on + p_days where id = v_m.id
  returning ends_on into v_ends;
  insert into public.membership_pauses (membership_id, gym_id, member_id, starts_on, ends_on, created_by)
  values (v_m.id, p_gym_id, p_member_id, p_starts_on, v_last, auth.uid());

  -- Classes and trainer sessions inside the pause are cancelled.
  update public.bookings b set status = 'cancelled'
  from public.classes c
  where c.id = b.class_id and c.gym_id = p_gym_id and b.member_id = p_member_id
    and b.status in ('booked', 'waitlisted') and c.starts_at > now()
    and (c.starts_at at time zone v_tz)::date between p_starts_on and v_last;
  update public.trainer_sessions s set status = 'cancelled'
  where s.gym_id = p_gym_id and s.member_id = p_member_id and s.status = 'booked'
    and s.starts_at > now()
    and (s.starts_at at time zone v_tz)::date between p_starts_on and v_last;

  if p_member_id is distinct from auth.uid() then
    perform public.notify(p_gym_id, p_member_id, 'membership', 'Membership paused',
      'Paused ' || to_char(p_starts_on, 'DD Mon') || ' to ' || to_char(v_last, 'DD Mon')
      || '. It now ends ' || to_char(v_ends, 'DD Mon YYYY') || '.');
  end if;
  return v_ends;
end;
$$;

revoke execute on function public.pause_membership(uuid, uuid, date, int) from public, anon;
grant execute on function public.pause_membership(uuid, uuid, date, int) to authenticated;

-- Ends a pause early, or cancels one that hasn't started. The days not used come off the
-- membership again, so the member can check in today. Returns the new end date.
create function public.end_pause(p_pause_id uuid) returns date
language plpgsql security definer set search_path = '' as $$
declare
  v_p public.membership_pauses;
  v_today date;
  v_unused int;
  v_old_end date;
  v_ends date;
begin
  select * into v_p from public.membership_pauses where id = p_pause_id for update;
  if v_p.id is null or not (v_p.member_id = auth.uid() or public.can_manage_gym(v_p.gym_id)) then
    raise exception 'Pause not found';
  end if;
  v_today := public.gym_day(v_p.gym_id);
  if v_p.ends_on < v_today then
    raise exception 'This pause is already over';
  end if;

  if v_p.starts_on >= v_today then
    v_unused := v_p.ends_on - v_p.starts_on + 1;
    delete from public.membership_pauses where id = v_p.id;
  else
    v_unused := v_p.ends_on - v_today + 1;
    update public.membership_pauses set ends_on = v_today - 1 where id = v_p.id;
  end if;

  select ends_on into v_old_end from public.memberships where id = v_p.membership_id for update;
  perform public.shift_later_memberships(v_p.gym_id, v_p.member_id, v_old_end, -v_unused);
  update public.memberships set ends_on = ends_on - v_unused where id = v_p.membership_id
  returning ends_on into v_ends;

  if v_p.member_id is distinct from auth.uid() then
    perform public.notify(v_p.gym_id, v_p.member_id, 'membership', 'Membership resumed',
      'Welcome back! It now ends ' || to_char(v_ends, 'DD Mon YYYY') || '.');
  end if;
  return v_ends;
end;
$$;

revoke execute on function public.end_pause(uuid) from public, anon;
grant execute on function public.end_pause(uuid) to authenticated;

-- 2. Class waitlist and booking cap -----------------------------------------------------

alter table public.bookings
  drop constraint bookings_status_check,
  add constraint bookings_status_check check (status in ('booked', 'waitlisted', 'cancelled', 'attended')),
  -- Queue order on the waitlist.
  add column waitlisted_at timestamptz;

create index on public.bookings (class_id, status, waitlisted_at);

create or replace view public.class_schedule as
  select
    c.id, c.gym_id, c.trainer_id, coalesce(p.full_name, 'TBA') as trainer_name, c.title,
    c.starts_at, c.duration_minutes, c.capacity,
    (select count(*)::int from public.bookings b
      where b.class_id = c.id and b.status = 'booked') as booked_count,
    c.series_id,
    (select count(*)::int from public.bookings b
      where b.class_id = c.id and b.status = 'waitlisted') as waitlist_count
  from public.classes c
  left join public.profiles p on p.id = c.trainer_id
  where public.is_gym_member(c.gym_id) and c.status = 'scheduled';

-- Books a spot, or joins the waitlist when the class is full. Members hold at most the
-- gym's class_booking_cap upcoming classes, waitlists included.
create or replace function public.book_class(p_class_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_class public.classes;
  v_existing text;
  v_cap int;
  v_mine int;
  v_booked int;
  v_status text;
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

  select status into v_existing from public.bookings
  where class_id = p_class_id and member_id = auth.uid();
  if v_existing = 'waitlisted' then
    raise exception 'Already on the waitlist';
  elsif v_existing is not null and v_existing <> 'cancelled' then
    raise exception 'Already booked';
  end if;

  select class_booking_cap into v_cap from public.gyms where id = v_class.gym_id;
  if v_cap is not null then
    select count(*) into v_mine
    from public.bookings b
    join public.classes c on c.id = b.class_id
    where b.member_id = auth.uid() and c.gym_id = v_class.gym_id and c.status = 'scheduled'
      and c.starts_at > now() and b.status in ('booked', 'waitlisted');
    if v_mine >= v_cap then
      raise exception 'You can hold % classes at a time. Cancel one to book this.', v_cap;
    end if;
  end if;

  select count(*) into v_booked from public.bookings
  where class_id = p_class_id and status = 'booked';
  v_status := case when v_booked >= v_class.capacity then 'waitlisted' else 'booked' end;

  insert into public.bookings (class_id, member_id, status, waitlisted_at)
  values (p_class_id, auth.uid(), v_status, case when v_status = 'waitlisted' then now() end)
  on conflict (class_id, member_id) do update
    set status = excluded.status, waitlisted_at = excluded.waitlisted_at
    where public.bookings.status = 'cancelled'
  returning id into v_id;

  if v_id is null then
    raise exception 'Already booked';
  end if;
  return v_id;
end;
$$;

-- Moves people off the waitlist, first come first served, while there are free spots.
-- Skips anyone without a current membership (or paused); they stay on the list.
create function public.fill_from_waitlist(p_class_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_class public.classes;
  v_free int;
  v_next public.bookings;
begin
  select * into v_class from public.classes where id = p_class_id for update;
  if not found or v_class.status <> 'scheduled' or v_class.starts_at <= now() then
    return;
  end if;
  v_free := v_class.capacity
    - (select count(*) from public.bookings where class_id = p_class_id and status = 'booked');

  for v_next in
    select * from public.bookings
    where class_id = p_class_id and status = 'waitlisted'
    order by waitlisted_at, id
    for update
  loop
    exit when v_free <= 0;
    continue when not public.has_current_membership(v_class.gym_id, v_next.member_id)
      or not exists (
        select 1 from public.gym_members
        where gym_id = v_class.gym_id and user_id = v_next.member_id and status = 'active'
      );
    update public.bookings set status = 'booked', waitlisted_at = null where id = v_next.id;
    v_free := v_free - 1;
    perform public.notify(v_class.gym_id, v_next.member_id, 'booking', 'You''re in',
      'A spot opened in ' || v_class.title || ' on ' || public.gym_time(v_class.gym_id, v_class.starts_at)
      || '. You''re booked.', v_class.id);
  end loop;
end;
$$;

revoke execute on function public.fill_from_waitlist(uuid) from public, anon, authenticated;

create function public.bookings_fill_waitlist() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'booked' and new.status <> 'booked' then
    perform public.fill_from_waitlist(new.class_id);
  end if;
  return null;
end;
$$;

create trigger bookings_fill_waitlist
  after update of status on public.bookings
  for each row execute function public.bookings_fill_waitlist();

create function public.classes_fill_waitlist() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.capacity > old.capacity then
    perform public.fill_from_waitlist(new.id);
  end if;
  return null;
end;
$$;

create trigger classes_fill_waitlist
  after update of capacity on public.classes
  for each row execute function public.classes_fill_waitlist();

-- The caller's place on each waitlist they're on at this gym (1 = next in).
create function public.my_waitlist_positions(p_gym_id uuid)
returns table (class_id uuid, waitlist_position int)
language sql stable security definer set search_path = '' as $$
  select b.class_id,
         (select count(*)::int from public.bookings o
          where o.class_id = b.class_id and o.status = 'waitlisted'
            and (o.waitlisted_at, o.id) < (b.waitlisted_at, b.id)) + 1
  from public.bookings b
  join public.classes c on c.id = b.class_id
  where b.member_id = auth.uid() and b.status = 'waitlisted' and c.gym_id = p_gym_id
$$;

revoke execute on function public.my_waitlist_positions(uuid) from public, anon;
grant execute on function public.my_waitlist_positions(uuid) to authenticated;

-- Cancelling a class clears its waitlist too.
create or replace function public.cancel_class(p_class_id uuid, p_rest_of_series boolean)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_class public.classes;
  v_ids uuid[];
begin
  select * into v_class from public.classes where id = p_class_id;
  if not found or not (
    public.has_gym_role(v_class.gym_id, array['owner'])
    or (v_class.trainer_id is not distinct from auth.uid()
        and public.has_gym_role(v_class.gym_id, array['trainer']))
  ) then
    raise exception 'Class not found';
  end if;

  select array_agg(id) into v_ids from public.classes
    where status = 'scheduled'
      and (
        id = p_class_id
        or (p_rest_of_series and v_class.series_id is not null
            and series_id = v_class.series_id and starts_at >= v_class.starts_at)
      );

  update public.classes set status = 'cancelled' where id = any (v_ids);
  update public.bookings set status = 'cancelled'
    where class_id = any (v_ids) and status in ('booked', 'waitlisted');
  return coalesce(array_length(v_ids, 1), 0);
end;
$$;

-- People on the waitlist hear when a class is cancelled or moved, too.
create or replace function public.announce_class_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_title text;
  v_body text;
  v_member uuid;
begin
  if old.status = 'scheduled' and new.status = 'cancelled' and old.starts_at > now() then
    v_title := 'Class cancelled';
    v_body := new.title || ' on ' || public.gym_time(new.gym_id, old.starts_at) || ' was cancelled.';
  elsif new.status = 'scheduled' and new.starts_at is distinct from old.starts_at and new.starts_at > now() then
    v_title := 'Class moved';
    v_body := new.title || ' now starts ' || public.gym_time(new.gym_id, new.starts_at) || '.';
  else
    return new;
  end if;

  for v_member in
    select member_id from public.bookings where class_id = new.id and status in ('booked', 'waitlisted')
  loop
    perform public.notify(new.gym_id, v_member, 'booking', v_title, v_body, new.id);
  end loop;
  if new.trainer_id is not null and new.trainer_id is distinct from auth.uid() then
    perform public.notify(new.gym_id, new.trainer_id, 'booking', v_title, v_body, new.id);
  end if;
  return new;
end;
$$;

-- 3. Referrals ----------------------------------------------------------------------------

-- Who referred the person behind an enquiry. Set only by refer_friend().
alter table public.enquiries
  add column referred_by uuid references public.profiles (id) on delete set null;

create index on public.enquiries (referred_by) where referred_by is not null;

create function public.guard_referral() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('corefit.referral', true) is distinct from 'on' and (
    (tg_op = 'INSERT' and new.referred_by is not null)
    or (tg_op = 'UPDATE' and new.referred_by is distinct from old.referred_by)
  ) then
    raise exception 'Referrals come from members';
  end if;
  return new;
end;
$$;

create trigger enquiries_guard_referral
  before insert or update on public.enquiries
  for each row execute function public.guard_referral();

-- One row per friend who joined. Free days go on the referrer's running membership, or on
-- their next one if nothing is running (applied_at stays null until then).
create table public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  enquiry_id uuid not null unique references public.enquiries (id) on delete cascade,
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid references public.profiles (id) on delete set null,
  days int not null check (days between 0 and 60),
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create index on public.referral_rewards (referrer_id, gym_id) where applied_at is null;

alter table public.referral_rewards enable row level security;

-- Written only by the membership triggers below.
create policy "Referrers read own rewards" on public.referral_rewards
  for select using (referrer_id = auth.uid());
create policy "Managers read rewards" on public.referral_rewards
  for select using (public.can_manage_gym(gym_id));

-- The last 10 digits of a phone number, to match +91 98400 12345 with 9840012345.
create function public.phone_key(p_phone text) returns text
language sql immutable set search_path = '' as $$
  select nullif(right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10), '')
$$;

-- A member refers a friend: the friend becomes an enquiry for the front desk to call,
-- and owners and supervisors get a push.
create function public.refer_friend(p_gym_id uuid, p_full_name text, p_phone text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[\s()-]', '', 'g');
  v_assignee uuid;
  v_me text;
  v_staff uuid;
  v_id uuid;
begin
  if not public.has_gym_role(p_gym_id, array['member']) then
    raise exception 'Only members refer friends';
  end if;
  -- Indian numbers keep their 10 digits, like the app.
  if v_phone ~ '^(\+91|91|0)?[6-9][0-9]{9}$' then
    v_phone := right(v_phone, 10);
  end if;
  if v_phone !~ '^\+?[0-9]{7,15}$' then
    raise exception 'Enter a valid mobile number';
  end if;
  if length(v_name) not between 2 and 60 then
    raise exception 'Enter their name';
  end if;
  if exists (
    select 1 from public.gym_members gm
    join public.contact_details cd on cd.user_id = gm.user_id
    where gm.gym_id = p_gym_id and public.phone_key(cd.phone) = public.phone_key(v_phone)
  ) then
    raise exception 'They''re already at this gym';
  end if;
  if exists (
    select 1 from public.enquiries
    where gym_id = p_gym_id and public.phone_key(phone) = public.phone_key(v_phone)
      and status in ('new', 'following_up', 'trial')
  ) then
    raise exception 'The gym is already in touch with them';
  end if;
  if (
    select count(*) from public.enquiries
    where referred_by = auth.uid() and created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception 'That''s 10 referrals today. Try again tomorrow.';
  end if;

  -- Enquiries need an owner or supervisor to follow up.
  select user_id into v_assignee from public.gym_members
  where gym_id = p_gym_id and status = 'active' and role in ('owner', 'supervisor')
  order by role = 'owner' desc, joined_at
  limit 1;
  if v_assignee is null then
    raise exception 'This gym can''t take referrals yet';
  end if;

  select full_name into v_me from public.profiles where id = auth.uid();
  perform set_config('corefit.referral', 'on', true);
  insert into public.enquiries (gym_id, full_name, phone, source, interest, assigned_to, referred_by)
  values (p_gym_id, v_name, v_phone, 'referral',
          left('Referred by ' || coalesce(nullif(trim(v_me), ''), 'a member'), 200),
          v_assignee, auth.uid())
  returning id into v_id;
  perform set_config('corefit.referral', 'off', true);

  for v_staff in
    select user_id from public.gym_members
    where gym_id = p_gym_id and status = 'active' and role in ('owner', 'supervisor')
  loop
    perform public.notify(p_gym_id, v_staff, 'message', 'New referral',
      coalesce(nullif(trim(v_me), ''), 'A member') || ' referred ' || v_name || '. Call ' || v_phone || '.');
  end loop;
  return v_id;
end;
$$;

revoke execute on function public.refer_friend(uuid, text, text) from public, anon;
grant execute on function public.refer_friend(uuid, text, text) to authenticated;

-- The caller's referrals at this gym, newest first. status: pending, joined or closed.
create function public.my_referrals(p_gym_id uuid)
returns table (
  id uuid, full_name text, status text, reward_days int, reward_applied boolean, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select e.id, e.full_name,
         case when r.id is not null then 'joined' when e.status = 'lost' then 'closed' else 'pending' end,
         r.days, r.applied_at is not null, e.created_at
  from public.enquiries e
  left join public.referral_rewards r on r.enquiry_id = e.id
  where e.gym_id = p_gym_id and e.referred_by = auth.uid()
  order by e.created_at desc
  limit 50
$$;

revoke execute on function public.my_referrals(uuid) from public, anon;
grant execute on function public.my_referrals(uuid) to authenticated;

-- Before a membership is saved: rewards waiting for this member (nothing was running
-- when their friend joined) add their days to it, if it runs into today or later.
create function public.apply_waiting_referral_rewards() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_gym uuid;
  v_days int;
begin
  select gym_id into v_gym from public.membership_plans where id = new.plan_id;
  if new.ends_on < public.gym_day(v_gym) then
    return new;
  end if;
  with applied as (
    update public.referral_rewards set applied_at = now()
    where gym_id = v_gym and referrer_id = new.member_id and applied_at is null and days > 0
    returning days
  )
  select coalesce(sum(days), 0) into v_days from applied;
  new.ends_on := new.ends_on + v_days;
  return new;
end;
$$;

create trigger memberships_apply_referral_rewards
  before insert on public.memberships
  for each row execute function public.apply_waiting_referral_rewards();

-- After a membership is saved: if it's a referred friend's first paid one, reward the
-- member who referred them. The friend is matched by account (a linked enquiry) or by
-- mobile number, and must have joined the gym after being referred.
create function public.reward_referral() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_gym uuid;
  v_key text;
  v_e public.enquiries;
  v_days int;
  v_target public.memberships;
  v_friend text;
begin
  if new.payment_method = 'complimentary' then
    return null;
  end if;
  select gym_id into v_gym from public.membership_plans where id = new.plan_id;
  if exists (
    select 1 from public.memberships m
    join public.membership_plans mp on mp.id = m.plan_id
    where mp.gym_id = v_gym and m.member_id = new.member_id and m.id <> new.id
      and m.payment_method is distinct from 'complimentary'
  ) then
    return null;
  end if;

  select public.phone_key(phone) into v_key from public.contact_details where user_id = new.member_id;
  select e.* into v_e
  from public.enquiries e
  where e.gym_id = v_gym and e.referred_by is not null and e.referred_by <> new.member_id
    and not exists (select 1 from public.referral_rewards r where r.enquiry_id = e.id)
    and (e.member_id = new.member_id
         or (e.member_id is null and v_key is not null and public.phone_key(e.phone) = v_key))
  order by e.member_id is not null desc, e.created_at
  limit 1;
  if v_e.id is null or exists (
    select 1 from public.gym_members
    where gym_id = v_gym and user_id = new.member_id and joined_at < v_e.created_at
  ) then
    return null;
  end if;

  select referral_reward_days into v_days from public.gyms where id = v_gym;
  insert into public.referral_rewards (gym_id, enquiry_id, referrer_id, friend_id, days, applied_at)
  values (v_gym, v_e.id, v_e.referred_by, new.member_id, v_days, case when v_days = 0 then now() end);

  -- Link the enquiry to their account. Never let a stale enquiry stop a payment.
  begin
    perform set_config('corefit.linking_enquiry', 'on', true);
    update public.enquiries set member_id = new.member_id, status = 'joined'
    where id = v_e.id and member_id is null;
    perform set_config('corefit.linking_enquiry', 'off', true);
  exception when others then
    perform set_config('corefit.linking_enquiry', 'off', true);
  end;

  select coalesce(nullif(trim(full_name), ''), 'Your friend') into v_friend
  from public.profiles where id = new.member_id;
  if v_days = 0 then
    perform public.notify(v_gym, v_e.referred_by, 'membership', 'Your friend joined',
      'Thanks for referring ' || v_friend || '!');
    return null;
  end if;

  select m.* into v_target
  from public.memberships m
  join public.membership_plans mp on mp.id = m.plan_id
  where mp.gym_id = v_gym and m.member_id = v_e.referred_by and m.ends_on >= public.gym_day(v_gym)
  order by m.ends_on desc
  limit 1
  for update of m;
  if v_target.id is null then
    perform public.notify(v_gym, v_e.referred_by, 'membership', 'Referral reward',
      v_friend || ' joined. ' || v_days || ' free days go on your next membership.');
    return null;
  end if;

  update public.memberships set ends_on = ends_on + v_days where id = v_target.id;
  update public.referral_rewards set applied_at = now() where enquiry_id = v_e.id;
  perform public.notify(v_gym, v_e.referred_by, 'membership', 'Referral reward',
    v_friend || ' joined. ' || v_days || ' free days added; your membership now ends '
    || to_char(v_target.ends_on + v_days, 'DD Mon YYYY') || '.');
  return null;
end;
$$;

create trigger memberships_reward_referral
  after insert on public.memberships
  for each row execute function public.reward_referral();
