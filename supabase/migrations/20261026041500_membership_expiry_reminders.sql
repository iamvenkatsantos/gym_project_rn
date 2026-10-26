-- Membership expiry reminders.
--
-- Members hear 7, 3 and 1 days before their membership ends, on the last day,
-- and the day after it ends. Owners and supervisors get a morning push when
-- someone's membership enters its last week or ends today, with how many end
-- this week. Staff can also nudge one member to renew from the app, once a day.
-- A renewal that runs past the end date means there's nothing to remind about.

-- The member's latest membership at a gym, with days left in the gym's own time
-- zone (0 on the last day, negative once it has ended).
create function public.latest_memberships(p_now timestamptz default now())
returns table (gym_id uuid, member_id uuid, membership_id uuid, plan_name text, ends_on date, days_left int)
language sql stable security definer set search_path = '' as $$
  select distinct on (mp.gym_id, m.member_id)
         mp.gym_id, m.member_id, m.id, mp.name, m.ends_on,
         m.ends_on - (p_now at time zone g.time_zone)::date
  from public.memberships m
  join public.membership_plans mp on mp.id = m.plan_id
  join public.gyms g on g.id = mp.gym_id
  join public.gym_members gm on gm.gym_id = mp.gym_id and gm.user_id = m.member_id and gm.status = 'active'
  order by mp.gym_id, m.member_id, m.ends_on desc
$$;

revoke execute on function public.latest_memberships(timestamptz) from public, anon, authenticated;

-- Same as before for classes and sessions; the membership part now covers more days
-- and tells staff.
create or replace function public.send_reminders(p_now timestamptz default now()) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Members booked into a class that starts within the hour.
  insert into public.notifications (gym_id, recipient_id, kind, title, body, class_id, dedupe_key)
  select c.gym_id, b.member_id, 'reminder', left(c.title, 68) || ' starts soon',
         'Your class starts at ' || public.gym_time(c.gym_id, c.starts_at, 'FMHH12:MI AM') || '. See you there!',
         c.id, 'class:' || c.id
  from public.bookings b
  join public.classes c on c.id = b.class_id
  join public.gym_members gm on gm.gym_id = c.gym_id and gm.user_id = b.member_id and gm.status = 'active'
  where b.status = 'booked' and c.status = 'scheduled'
    and c.starts_at > p_now and c.starts_at <= p_now + interval '1 hour'
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

  -- The trainer teaching it, with how many are coming.
  insert into public.notifications (gym_id, recipient_id, kind, title, body, class_id, dedupe_key)
  select c.gym_id, c.trainer_id, 'reminder', left(c.title, 68) || ' starts soon',
         'You''re teaching at ' || public.gym_time(c.gym_id, c.starts_at, 'FMHH12:MI AM') || '. '
           || (select count(*) from public.bookings b where b.class_id = c.id and b.status = 'booked')
           || ' booked.',
         c.id, 'class:' || c.id
  from public.classes c
  join public.gym_members gm on gm.gym_id = c.gym_id and gm.user_id = c.trainer_id and gm.status = 'active'
  where c.status = 'scheduled' and c.trainer_id is not null
    and c.starts_at > p_now and c.starts_at <= p_now + interval '1 hour'
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

  -- 1:1 sessions within the hour, for the member and the trainer.
  insert into public.notifications (gym_id, recipient_id, kind, title, body, dedupe_key)
  select s.gym_id, who.recipient_id, 'reminder', 'Session starts soon',
         'Your session with ' || coalesce(p.full_name, 'your ' || who.other) || ' starts at '
           || public.gym_time(s.gym_id, s.starts_at, 'FMHH12:MI AM') || '.',
         'session:' || s.id
  from public.trainer_sessions s
  cross join lateral (
    values (s.member_id, s.trainer_id, 'trainer'), (s.trainer_id, s.member_id, 'member')
  ) as who (recipient_id, other_id, other)
  join public.gym_members gm on gm.gym_id = s.gym_id and gm.user_id = who.recipient_id and gm.status = 'active'
  left join public.profiles p on p.id = who.other_id
  where s.status = 'booked' and s.starts_at > p_now and s.starts_at <= p_now + interval '1 hour'
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

  -- Members whose latest membership ends in 7, 3 or 1 days, today, or ended
  -- yesterday, sent from 9 am gym time. The keys for 3 days and today match the
  -- earlier job, so nobody hears those twice.
  insert into public.notifications (gym_id, recipient_id, kind, title, body, dedupe_key)
  select lm.gym_id, lm.member_id, 'membership',
         case lm.days_left
           when -1 then 'Membership has ended'
           when 0 then 'Membership ends today'
           when 1 then 'Membership ends tomorrow'
           else 'Membership ends soon'
         end,
         'Your ' || lm.plan_name || ' membership '
           || case lm.days_left
                when -1 then 'ended yesterday'
                when 0 then 'ends today'
                when 1 then 'ends tomorrow'
                else 'ends on ' || to_char(lm.ends_on, 'DD Mon')
              end
           || '. Renew at the front desk to keep training.',
         'membership:' || lm.membership_id || ':' || lm.days_left
  from public.latest_memberships(p_now) lm
  join public.gyms g on g.id = lm.gym_id
  where lm.days_left in (7, 3, 1, 0, -1)
    and extract(hour from p_now at time zone g.time_zone) >= 9
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

  -- Owners and supervisors, on mornings when someone's membership enters its
  -- last week or ends today: how many end in the next 7 days, and who.
  insert into public.notifications (gym_id, recipient_id, kind, title, body, dedupe_key)
  select due.gym_id, gm.user_id, 'membership',
         case when due.total = 1 then '1 membership ends this week'
              else due.total || ' memberships end this week' end,
         due.names
           || case when due.total > 3 then ' and ' || (due.total - 3) || ' more' else '' end
           || '. Open Renewals due on your dashboard to remind them.',
         'renewals:' || due.gym_id || ':' || due.today
  from (
    select lm.gym_id, (p_now at time zone g.time_zone)::date as today, count(*)::int as total,
           string_agg(coalesce(p.full_name, 'A member'), ', ' order by lm.ends_on, p.full_name)
             filter (where lm.rank <= 3) as names
    from (
      select l.*, row_number() over (partition by l.gym_id order by l.ends_on, l.member_id) as rank
      from public.latest_memberships(p_now) l
      where l.days_left between 0 and 6
    ) lm
    join public.gyms g on g.id = lm.gym_id
    left join public.profiles p on p.id = lm.member_id
    where extract(hour from p_now at time zone g.time_zone) >= 9
    group by lm.gym_id, g.time_zone
    having bool_or(lm.days_left in (6, 0))
  ) due
  join public.gym_members gm
    on gm.gym_id = due.gym_id and gm.role in ('owner', 'supervisor') and gm.status = 'active'
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
end;
$$;

revoke execute on function public.send_reminders(timestamptz) from public, anon, authenticated;

-- An owner or supervisor taps Remind on a member whose membership is ending or
-- has ended. Each member hears at most once a day, however many staff tap it.
-- Returns false when they were already reminded today.
create function public.remind_renewal(p_gym_id uuid, p_member_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_lm record;
  v_gym text;
  v_sent int;
begin
  if not public.can_manage_gym(p_gym_id) then
    raise exception 'Only owners and supervisors can send renewal reminders';
  end if;
  select * into v_lm from public.latest_memberships() lm
  where lm.gym_id = p_gym_id and lm.member_id = p_member_id;
  if v_lm is null then
    raise exception 'This member has no membership at your gym';
  end if;
  select name into v_gym from public.gyms where id = p_gym_id;

  insert into public.notifications (gym_id, recipient_id, sender_id, kind, title, body, dedupe_key)
  values (p_gym_id, p_member_id, auth.uid(), 'membership', 'Time to renew',
          left('Your ' || v_lm.plan_name || ' membership at ' || v_gym
            || case when v_lm.days_left < 0 then ' ended on ' else ' ends on ' end
            || to_char(v_lm.ends_on, 'DD Mon') || '. Renew at the front desk to keep training.', 500),
          'renewal-nudge:' || p_gym_id || ':' || public.gym_day(p_gym_id))
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_sent = row_count;
  return v_sent > 0;
end;
$$;

revoke execute on function public.remind_renewal(uuid, uuid) from public, anon;
grant execute on function public.remind_renewal(uuid, uuid) to authenticated;
