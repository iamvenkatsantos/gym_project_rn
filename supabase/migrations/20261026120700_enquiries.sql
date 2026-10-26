-- Walk-in enquiries, follow-ups and trial passes.
--
-- The front desk (owners and supervisors) notes everyone who asks about
-- joining: walk-ins, calls, referrals. Each enquiry moves through
--   new → following_up → trial → joined, or lost at any point
-- with a timeline of calls, visits and notes. A follow-up time sends the
-- assigned staff member a reminder push when it's due. Inviting the person as
-- a member marks the enquiry joined, and it links to their account as soon as
-- they join the gym with the same email.

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 2 and 60),
  -- Digits only, with an optional leading +, e.g. 9840012345 or +447700900123.
  phone text not null check (phone ~ '^\+?[0-9]{7,15}$'),
  email text check (email is null or (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254)),
  source text not null default 'walk_in'
    check (source in ('walk_in', 'phone', 'referral', 'social', 'other')),
  -- What they asked about: a goal, a plan, a time of day.
  interest text not null default '' check (length(interest) <= 200),
  status text not null default 'new'
    check (status in ('new', 'following_up', 'trial', 'joined', 'lost')),
  next_follow_up_at timestamptz,
  trial_starts_on date,
  trial_ends_on date,
  lost_reason text not null default '' check (length(lost_reason) <= 200),
  -- The staff member who follows up; reminders go to them.
  assigned_to uuid references public.profiles (id) on delete set null,
  -- Their account once they've joined the gym.
  member_id uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((trial_starts_on is null) = (trial_ends_on is null)),
  check (trial_ends_on >= trial_starts_on)
);

create index on public.enquiries (gym_id, status, next_follow_up_at);
create index on public.enquiries (next_follow_up_at) where status in ('new', 'following_up', 'trial');

-- The timeline: calls, visits and notes staff log, and status changes.
create table public.enquiry_notes (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries (id) on delete cascade,
  kind text not null check (kind in ('note', 'call', 'visit', 'status')),
  body text not null check (length(trim(body)) between 1 and 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index on public.enquiry_notes (enquiry_id, created_at desc);

alter table public.enquiries enable row level security;
alter table public.enquiry_notes enable row level security;

-- Owners and supervisors run the front desk; members and trainers never see enquiries.
create policy "Staff read enquiries" on public.enquiries
  for select using (public.can_manage_gym(gym_id));
create policy "Staff add enquiries" on public.enquiries
  for insert with check (public.can_manage_gym(gym_id));
create policy "Staff update enquiries" on public.enquiries
  for update using (public.can_manage_gym(gym_id)) with check (public.can_manage_gym(gym_id));
-- Supervisors mark an enquiry lost; only owners delete one, e.g. a duplicate.
create policy "Owners delete enquiries" on public.enquiries
  for delete using (public.has_gym_role(gym_id, array['owner']));

-- Notes are written by log_enquiry_follow_up and the status trigger below.
create policy "Staff read enquiry notes" on public.enquiry_notes
  for select using (exists (
    select 1 from public.enquiries e where e.id = enquiry_id and public.can_manage_gym(e.gym_id)
  ));

-- Keeps enquiries tidy and honest: who made it can't be faked, it can't move
-- gyms, and only the gym's owners and supervisors can be assigned.
create function public.check_enquiry() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
    new.assigned_to := coalesce(new.assigned_to, auth.uid());
  else
    if new.gym_id <> old.gym_id or new.created_by is distinct from old.created_by
       or new.created_at <> old.created_at then
      raise exception 'An enquiry stays with its gym';
    end if;
    -- The account link is set when they join, never by hand.
    if new.member_id is distinct from old.member_id and current_setting('corefit.linking_enquiry', true) is distinct from 'on' then
      raise exception 'An enquiry links to a member when they join';
    end if;
  end if;
  if tg_op = 'INSERT' and new.member_id is not null then
    raise exception 'An enquiry links to a member when they join';
  end if;
  new.full_name := trim(new.full_name);
  new.interest := trim(new.interest);
  new.lost_reason := trim(new.lost_reason);
  new.email := nullif(lower(trim(new.email)), '');
  new.updated_at := now();
  if new.assigned_to is not null and not exists (
    select 1 from public.gym_members
    where gym_id = new.gym_id and user_id = new.assigned_to and status = 'active'
      and role in ('owner', 'supervisor')
  ) then
    raise exception 'Assign an owner or supervisor of this gym';
  end if;
  if new.status = 'trial' and new.trial_starts_on is null then
    raise exception 'Give the trial pass dates';
  end if;
  -- Nothing left to follow up once they've joined or said no.
  if new.status in ('joined', 'lost') then
    new.next_follow_up_at := null;
  end if;
  if new.status <> 'lost' then
    new.lost_reason := '';
  end if;
  return new;
end;
$$;

create trigger enquiries_check
  before insert or update on public.enquiries
  for each row execute function public.check_enquiry();

-- Adds a line to the timeline whenever the status changes.
create function public.log_enquiry_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_body text;
begin
  if new.member_id is not null and old.member_id is null then
    v_body := 'Joined the gym';
  elsif new.status = old.status and new.trial_ends_on is not distinct from old.trial_ends_on then
    return new;
  else
    v_body := case new.status
    when 'new' then 'Reopened'
    when 'following_up' then case when old.status in ('joined', 'lost') then 'Reopened' else 'Following up' end
    when 'trial' then 'Trial pass ' || to_char(new.trial_starts_on, 'DD Mon') || ' to ' || to_char(new.trial_ends_on, 'DD Mon')
    when 'joined' then 'Invited as a member'
    when 'lost' then 'Marked lost' || case when new.lost_reason <> '' then ': ' || new.lost_reason else '' end
    end;
  end if;
  insert into public.enquiry_notes (enquiry_id, kind, body, created_by)
  values (new.id, 'status', left(v_body, 500), auth.uid());
  return new;
end;
$$;

create trigger enquiries_log_status
  after update of status, trial_ends_on, member_id on public.enquiries
  for each row execute function public.log_enquiry_status();

-- Logs a call, visit or note and sets (or clears) the next follow-up in one go.
-- A new enquiry moves to following up once someone has followed up.
create function public.log_enquiry_follow_up(
  p_enquiry_id uuid, p_kind text, p_body text, p_next_at timestamptz
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_enquiry public.enquiries;
begin
  select * into v_enquiry from public.enquiries where id = p_enquiry_id;
  if v_enquiry is null or not public.can_manage_gym(v_enquiry.gym_id) then
    raise exception 'Enquiry not found';
  end if;
  if p_kind not in ('note', 'call', 'visit') then
    raise exception 'Log a call, visit or note';
  end if;
  if p_next_at is not null and p_next_at < now() - interval '5 minutes' then
    raise exception 'Pick a follow-up time in the future';
  end if;
  insert into public.enquiry_notes (enquiry_id, kind, body, created_by)
  values (p_enquiry_id, p_kind,
          coalesce(nullif(trim(p_body), ''), case p_kind when 'call' then 'Called' when 'visit' then 'Visited' else 'Note' end),
          auth.uid());
  update public.enquiries
  set next_follow_up_at = case when status in ('joined', 'lost') then null else p_next_at end,
      status = case when status = 'new' then 'following_up' else status end
  where id = p_enquiry_id;
end;
$$;

revoke execute on function public.log_enquiry_follow_up(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.log_enquiry_follow_up(uuid, text, text, timestamptz) to authenticated;

-- When someone joins a gym as a member, their open enquiries there (matched by
-- email) link to their account and count as joined.
create function public.link_enquiries() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
begin
  if new.role <> 'member' or new.status <> 'active' then
    return new;
  end if;
  select lower(email) into v_email from auth.users where id = new.user_id;
  if v_email is null then
    return new;
  end if;
  perform set_config('corefit.linking_enquiry', 'on', true);
  update public.enquiries
  set member_id = new.user_id, status = 'joined'
  where gym_id = new.gym_id and email = v_email and member_id is null;
  perform set_config('corefit.linking_enquiry', 'off', true);
  return new;
end;
$$;

create trigger gym_members_link_enquiries
  after insert on public.gym_members
  for each row execute function public.link_enquiries();

-- Reminders -------------------------------------------------------------------------

-- Run by pg_cron every five minutes, like send_reminders. Each follow-up time
-- is one dedupe key, so moving the follow-up sends a fresh reminder and running
-- the job again never sends one twice. Follow-ups over a day late are left to
-- the Enquiries screen rather than pushed. p_now is only there for tests.
create function public.send_enquiry_reminders(p_now timestamptz default now()) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (gym_id, recipient_id, kind, title, body, dedupe_key)
  select e.gym_id, gm.user_id, 'reminder',
         left('Follow up with ' || e.full_name, 80),
         left(case when e.status = 'trial' then 'On a trial pass until ' || to_char(e.trial_ends_on, 'DD Mon') || '. '
                   else '' end
              || 'Call ' || e.phone
              || case when e.interest <> '' then '. Asked about: ' || e.interest else '' end || '.', 500),
         'enquiry:' || e.id || ':' || extract(epoch from e.next_follow_up_at)::bigint
  from public.enquiries e
  join public.gym_members gm
    on gm.gym_id = e.gym_id and gm.user_id = coalesce(e.assigned_to, e.created_by)
   and gm.status = 'active' and gm.role in ('owner', 'supervisor')
  where e.status in ('new', 'following_up', 'trial')
    and e.next_follow_up_at <= p_now and e.next_follow_up_at > p_now - interval '1 day'
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
end;
$$;

revoke execute on function public.send_enquiry_reminders(timestamptz) from public, anon, authenticated;

-- Its own job, so it never collides with changes to send_reminders.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('corefit-enquiry-reminders', '*/5 * * * *', 'select public.send_enquiry_reminders()');
  end if;
end;
$$;
