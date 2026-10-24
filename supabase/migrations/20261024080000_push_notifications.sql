-- Push notifications.
--
-- Every inbox row is also pushed to the recipient's phones: a trigger hands new
-- notification ids to the send-push edge function, which looks up their Expo
-- push tokens. New inbox rows come from booking changes, recorded memberships,
-- and a reminders job (class and 1:1 session reminders, memberships about to
-- end) that pg_cron runs every five minutes.
--
-- Pushing needs two Vault secrets, project_url and push_webhook_secret (see the
-- README). Until they exist the inbox works as before and nothing is pushed.

-- Device tokens ---------------------------------------------------------------------

create table public.push_tokens (
  token text primary key check (token ~ '^Expo(nent)?PushToken\[.+\]$'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

create index on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- Writes go through the functions below; the edge function reads with the service role.
create policy "Read your push tokens" on public.push_tokens
  for select using (user_id = auth.uid());

-- A phone has one token whoever is signed in, so the latest sign-in takes it over.
create function public.register_push_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  insert into public.push_tokens (token, user_id, platform)
  values (p_token, auth.uid(), p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

create function public.unregister_push_token(p_token text) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid()
$$;

revoke execute on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
revoke execute on function public.unregister_push_token(text) from public, anon;
grant execute on function public.unregister_push_token(text) to authenticated;

-- Inbox -----------------------------------------------------------------------------

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('message', 'trainer_request', 'trainer_assigned', 'reminder', 'booking', 'membership'));

-- Reminders carry a key so each one is sent once, however often the job runs.
alter table public.notifications add column dedupe_key text;
create unique index notifications_once
  on public.notifications (recipient_id, dedupe_key) where dedupe_key is not null;

-- "Mon 26 Oct, 6:00 PM" in the gym's own time zone.
create function public.gym_time(p_gym_id uuid, p_at timestamptz, p_format text default 'Dy DD Mon, FMHH12:MI AM')
returns text
language sql stable security definer set search_path = '' as $$
  select to_char(p_at at time zone g.time_zone, p_format) from public.gyms g where g.id = p_gym_id
$$;

revoke execute on function public.gym_time(uuid, timestamptz, text) from public, anon, authenticated;

-- Push ------------------------------------------------------------------------------

-- Hands each batch of new inbox rows to the send-push edge function. pg_net sends
-- the request after the transaction commits and never blocks it; anything that
-- goes wrong here only costs the push, never the notification.
create function public.push_new_notifications() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[];
  v_url text;
  v_secret text;
begin
  if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then
    return null;
  end if;
  select array_agg(id) into v_ids from inserted;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1'
    into v_url using 'project_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1'
    into v_secret using 'push_webhook_secret';
  if v_ids is null or v_url is null or v_secret is null then
    return null;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 10000)'
    using rtrim(v_url, '/') || '/functions/v1/send-push',
          jsonb_build_object('ids', v_ids),
          jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret);
  return null;
exception when others then
  raise warning 'push skipped: %', sqlerrm;
  return null;
end;
$$;

create trigger notifications_push
  after insert on public.notifications
  referencing new table as inserted
  for each statement execute function public.push_new_notifications();

-- Booking changes -------------------------------------------------------------------

-- Members booked into a class hear when it's cancelled or moved; so does its
-- trainer, unless they made the change.
create function public.announce_class_change() returns trigger
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
    select member_id from public.bookings where class_id = new.id and status = 'booked'
  loop
    perform public.notify(new.gym_id, v_member, 'booking', v_title, v_body, new.id);
  end loop;
  if new.trainer_id is not null and new.trainer_id is distinct from auth.uid() then
    perform public.notify(new.gym_id, new.trainer_id, 'booking', v_title, v_body, new.id);
  end if;
  return new;
end;
$$;

create trigger classes_announce_change
  after update of status, starts_at on public.classes
  for each row execute function public.announce_class_change();

-- Trainers hear about new 1:1 bookings; whoever didn't cancel a session hears it was.
create function public.announce_trainer_session() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_member text;
  v_trainer text;
  v_when text := public.gym_time(new.gym_id, new.starts_at);
begin
  select full_name into v_member from public.profiles where id = new.member_id;
  select full_name into v_trainer from public.profiles where id = new.trainer_id;
  if tg_op = 'INSERT' and new.status = 'booked' then
    perform public.notify(new.gym_id, new.trainer_id, 'booking', 'New session booked',
      coalesce(v_member, 'A member') || ' booked a session with you on ' || v_when || '.');
  elsif tg_op = 'UPDATE' and old.status = 'booked' and new.status = 'cancelled' then
    if auth.uid() is not distinct from new.member_id then
      perform public.notify(new.gym_id, new.trainer_id, 'booking', 'Session cancelled',
        coalesce(v_member, 'A member') || ' cancelled their session on ' || v_when || '.');
    else
      perform public.notify(new.gym_id, new.member_id, 'booking', 'Session cancelled',
        'Your session with ' || coalesce(v_trainer, 'your trainer') || ' on ' || v_when || ' was cancelled.');
    end if;
  end if;
  return new;
end;
$$;

create trigger trainer_sessions_announce
  after insert or update of status on public.trainer_sessions
  for each row execute function public.announce_trainer_session();

-- Memberships -----------------------------------------------------------------------

create function public.announce_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.membership_plans;
begin
  select * into v_plan from public.membership_plans where id = new.plan_id;
  perform public.notify(v_plan.gym_id, new.member_id, 'membership', 'Membership active',
    v_plan.name || ' runs until ' || to_char(new.ends_on, 'DD Mon YYYY') || '. Thanks for training with us!');
  return new;
end;
$$;

create trigger memberships_announce
  after insert on public.memberships
  for each row execute function public.announce_membership();

-- Reminders -------------------------------------------------------------------------

-- Run by pg_cron every five minutes. Each reminder has a dedupe key, so running
-- it again (or late) never sends one twice. Only active people at the gym hear.
-- p_now is only there so tests can pick the time.
create function public.send_reminders(p_now timestamptz default now()) returns void
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

  -- Memberships ending in 3 days, and on their last day, sent from 9 am gym time.
  -- A renewal that runs past it means there's nothing to remind about.
  insert into public.notifications (gym_id, recipient_id, kind, title, body, dedupe_key)
  select mp.gym_id, m.member_id, 'membership',
         case when d.days_left = 0 then 'Membership ends today' else 'Membership ends soon' end,
         'Your ' || mp.name || ' membership '
           || case when d.days_left = 0 then 'ends today' else 'ends on ' || to_char(m.ends_on, 'DD Mon') end
           || '. Renew at the front desk to keep training.',
         'membership:' || m.id || ':' || d.days_left
  from public.memberships m
  join public.membership_plans mp on mp.id = m.plan_id
  join public.gyms g on g.id = mp.gym_id
  join public.gym_members gm on gm.gym_id = mp.gym_id and gm.user_id = m.member_id and gm.status = 'active'
  cross join lateral (
    select m.ends_on - (p_now at time zone g.time_zone)::date as days_left,
           extract(hour from p_now at time zone g.time_zone) as local_hour
  ) d
  where d.days_left in (0, 3) and d.local_hour >= 9
    and not exists (
      select 1 from public.memberships m2
      join public.membership_plans mp2 on mp2.id = m2.plan_id
      where m2.member_id = m.member_id and mp2.gym_id = mp.gym_id and m2.ends_on > m.ends_on
    )
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
end;
$$;

revoke execute on function public.send_reminders(timestamptz) from public, anon, authenticated;

-- Supabase has pg_cron and pg_net; plain Postgres (supabase/tests) does not, and skips them.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('corefit-reminders', '*/5 * * * *', 'select public.send_reminders()');
  end if;
end;
$$;
