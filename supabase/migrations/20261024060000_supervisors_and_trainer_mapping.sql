-- Supervisors and trainer mapping.
--
-- A supervisor is the owner's second-in-command: they see and record payments,
-- invite members and trainers, map members to trainers and keep an eye on
-- classes, but can't change roles, remove people or edit the gym's plans.
-- Members are mapped to one or more trainers; that mapping, not plan
-- assignment, is what lets a trainer coach a member. Members can ask for a
-- trainer, and owners or supervisors approve it. Trainers now schedule their
-- own classes, and an in-app inbox carries nudges and request updates.

-- Roles -----------------------------------------------------------------------------

alter table public.gym_members drop constraint gym_members_role_check;
alter table public.gym_members add constraint gym_members_role_check
  check (role in ('member', 'trainer', 'supervisor', 'owner'));
alter table public.gym_invites drop constraint gym_invites_role_check;
alter table public.gym_invites add constraint gym_invites_role_check
  check (role in ('member', 'trainer', 'supervisor', 'owner'));

-- Owners and supervisors: the people who run the gym day to day.
create function public.can_manage_gym(p_gym_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_gym_role(p_gym_id, array['owner', 'supervisor'])
$$;

-- Owners invite anyone; supervisors invite members and trainers.
create or replace function public.invite_to_gym(p_gym_id uuid, p_email text, p_role text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
  v_user_id uuid;
begin
  if not public.can_manage_gym(p_gym_id) then
    raise exception 'Only owners and supervisors can invite people';
  end if;
  if p_role not in ('member', 'trainer', 'supervisor', 'owner') then
    raise exception 'Unknown role';
  end if;
  if p_role not in ('member', 'trainer') and not public.has_gym_role(p_gym_id, array['owner']) then
    raise exception 'Only owners can invite supervisors and owners';
  end if;
  if v_email not like '%_@_%' then
    raise exception 'Enter a valid email address';
  end if;

  select id into v_user_id from auth.users
    where lower(email) = v_email and email_confirmed_at is not null;

  if v_user_id is not null then
    insert into public.gym_members (gym_id, user_id, role)
    values (p_gym_id, v_user_id, p_role)
    on conflict (gym_id, user_id) do nothing;
    return case when found then 'added' else 'already_member' end;
  end if;

  insert into public.gym_invites (gym_id, email, role, invited_by)
  values (p_gym_id, v_email, p_role, auth.uid())
  on conflict (gym_id, email) do update set role = excluded.role, invited_by = excluded.invited_by;
  return 'invited';
end;
$$;

drop policy "Owners read invites" on public.gym_invites;
drop policy "Owners withdraw invites" on public.gym_invites;
create policy "Managers read invites" on public.gym_invites
  for select using (public.can_manage_gym(gym_id));
create policy "Managers withdraw invites they could send" on public.gym_invites
  for delete using (
    public.has_gym_role(gym_id, array['owner'])
    or (public.has_gym_role(gym_id, array['supervisor']) and role in ('member', 'trainer'))
  );

create or replace function public.gym_people(p_gym_id uuid)
returns table (
  user_id uuid, full_name text, email text, role text, status text, joined_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select gm.user_id, p.full_name, u.email::text, gm.role, gm.status, gm.joined_at
  from public.gym_members gm
  join public.profiles p on p.id = gm.user_id
  join auth.users u on u.id = gm.user_id
  where gm.gym_id = p_gym_id and public.can_manage_gym(p_gym_id)
  order by p.full_name
$$;

-- Payments: supervisors see every membership and record new ones or renewals.
-- Changing or deleting a recorded payment stays with owners.
create policy "Supervisors read memberships" on public.memberships
  for select using (
    exists (
      select 1 from public.membership_plans mp
      where mp.id = plan_id and public.has_gym_role(mp.gym_id, array['supervisor'])
    )
  );
create policy "Supervisors record memberships" on public.memberships
  for insert with check (
    exists (
      select 1 from public.membership_plans mp
      join public.gym_members gm on gm.gym_id = mp.gym_id and gm.user_id = member_id
      where mp.id = plan_id and public.has_gym_role(mp.gym_id, array['supervisor'])
    )
  );

-- Supervisors follow classes and 1:1 sessions.
create policy "Supervisors read gym sessions" on public.trainer_sessions
  for select using (public.has_gym_role(gym_id, array['supervisor']));
drop policy "Staff read class bookings" on public.bookings;
create policy "Staff read class bookings" on public.bookings
  for select using (
    exists (
      select 1 from public.classes c
      where c.id = class_id
        and public.has_gym_role(c.gym_id, array['trainer', 'supervisor', 'owner'])
    )
  );

-- Trainer mapping -------------------------------------------------------------------

create table public.member_trainers (
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null default auth.uid(),
  assigned_at timestamptz not null default now(),
  primary key (gym_id, member_id, trainer_id)
);

create index on public.member_trainers (gym_id, trainer_id);

-- Both sides must hold the right role at that gym.
create function public.check_member_trainer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.gym_members
    where gym_id = new.gym_id and user_id = new.member_id and role = 'member' and status = 'active'
  ) then
    raise exception 'Pick an active member of this gym';
  end if;
  if not exists (
    select 1 from public.gym_members
    where gym_id = new.gym_id and user_id = new.trainer_id and role = 'trainer' and status = 'active'
  ) then
    raise exception 'Pick a trainer from this gym';
  end if;
  return new;
end;
$$;

create trigger member_trainers_check
  before insert on public.member_trainers
  for each row execute function public.check_member_trainer();

-- Plans already assigned show who coaches whom today.
insert into public.member_trainers (gym_id, member_id, trainer_id, assigned_by, assigned_at)
  select distinct on (w.gym_id, a.member_id, w.trainer_id)
    w.gym_id, a.member_id, w.trainer_id, a.assigned_by, a.assigned_at
  from public.workout_assignments a
  join public.workouts w on w.id = a.workout_id
  join public.gym_members m on m.gym_id = w.gym_id and m.user_id = a.member_id
    and m.role = 'member' and m.status = 'active'
  join public.gym_members t on t.gym_id = w.gym_id and t.user_id = w.trainer_id
    and t.role = 'trainer' and t.status = 'active'
  order by w.gym_id, a.member_id, w.trainer_id, a.assigned_at;

-- Unmapping a trainer takes their plans off the member too.
create function public.unassign_trainer_plans() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.workout_assignments a
    using public.workouts w
    where w.id = a.workout_id and a.member_id = old.member_id
      and w.trainer_id = old.trainer_id and w.gym_id = old.gym_id;
  return old;
end;
$$;

create trigger member_trainers_unassign_plans
  after delete on public.member_trainers
  for each row execute function public.unassign_trainer_plans();

-- Leaving the gym or changing role ends the person's mappings.
create function public.drop_trainer_links() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' or new.role <> old.role then
    delete from public.member_trainers
      where gym_id = old.gym_id and (member_id = old.user_id or trainer_id = old.user_id);
  end if;
  return coalesce(new, old);
end;
$$;

create trigger gym_members_drop_trainer_links
  after update of role or delete on public.gym_members
  for each row execute function public.drop_trainer_links();

alter table public.member_trainers enable row level security;

create policy "Read your trainer links" on public.member_trainers
  for select using (
    member_id = auth.uid() or trainer_id = auth.uid() or public.can_manage_gym(gym_id)
  );
create policy "Managers map members to trainers" on public.member_trainers
  for insert with check (public.can_manage_gym(gym_id));
create policy "Managers unmap members" on public.member_trainers
  for delete using (public.can_manage_gym(gym_id));

-- A trainer coaches the members mapped to them.
create or replace function public.trains_member(p_member_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.member_trainers mt
    where mt.member_id = p_member_id
      and mt.trainer_id = auth.uid()
      and public.has_gym_role(mt.gym_id, array['trainer'])
  )
$$;

-- Plans can only go to members mapped to the plan's trainer.
drop policy "Plan authors assign plans" on public.workout_assignments;
create policy "Plan authors assign plans" on public.workout_assignments
  for all using (public.can_edit_workout(workout_id))
  with check (
    public.can_edit_workout(workout_id)
    and exists (
      select 1 from public.workouts w
      join public.member_trainers mt
        on mt.gym_id = w.gym_id and mt.trainer_id = w.trainer_id
        and mt.member_id = workout_assignments.member_id
      where w.id = workout_id
    )
  );

-- Inbox -----------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('message', 'trainer_request', 'trainer_assigned')),
  title text not null check (length(trim(title)) between 1 and 80),
  body text not null default '' check (length(body) <= 500),
  class_id uuid references public.classes (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;

-- Writes go through the functions below; people read and mark their own.
create policy "Read your notifications" on public.notifications
  for select using (recipient_id = auth.uid());
create policy "Mark your notifications read" on public.notifications
  for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- Internal: not callable from the app.
create function public.notify(
  p_gym_id uuid, p_recipient_id uuid, p_kind text, p_title text, p_body text,
  p_class_id uuid default null
) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (gym_id, recipient_id, sender_id, kind, title, body, class_id)
  values (p_gym_id, p_recipient_id, auth.uid(), p_kind, p_title, left(p_body, 500), p_class_id)
$$;

revoke execute on function public.notify(uuid, uuid, text, text, text, uuid) from public, anon, authenticated;

-- Owners and supervisors message a trainer, e.g. to schedule or follow up on a class.
create function public.message_trainer(
  p_gym_id uuid, p_trainer_id uuid, p_title text, p_body text, p_class_id uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_gym(p_gym_id) then
    raise exception 'Only owners and supervisors can message trainers';
  end if;
  if not exists (
    select 1 from public.gym_members
    where gym_id = p_gym_id and user_id = p_trainer_id and role = 'trainer' and status = 'active'
  ) then
    raise exception 'Pick a trainer from this gym';
  end if;
  if p_class_id is not null and not exists (
    select 1 from public.classes where id = p_class_id and gym_id = p_gym_id
  ) then
    raise exception 'Class not found';
  end if;
  if length(trim(p_title)) = 0 then
    raise exception 'Add a subject';
  end if;
  perform public.notify(p_gym_id, p_trainer_id, 'message', trim(p_title), trim(p_body), p_class_id);
end;
$$;

revoke execute on function public.message_trainer(uuid, uuid, text, text, uuid) from public, anon;
grant execute on function public.message_trainer(uuid, uuid, text, text, uuid) to authenticated;

-- A new mapping tells both the member and the trainer.
create function public.announce_member_trainer() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_member text;
  v_trainer text;
begin
  select full_name into v_member from public.profiles where id = new.member_id;
  select full_name into v_trainer from public.profiles where id = new.trainer_id;
  perform public.notify(new.gym_id, new.member_id, 'trainer_assigned',
    'Meet your trainer', coalesce(v_trainer, 'A trainer') || ' is now your trainer.');
  perform public.notify(new.gym_id, new.trainer_id, 'trainer_assigned',
    'New member', coalesce(v_member, 'A member') || ' is now one of your members.');
  return new;
end;
$$;

create trigger member_trainers_announce
  after insert on public.member_trainers
  for each row execute function public.announce_member_trainer();

-- Trainer requests ------------------------------------------------------------------

create table public.trainer_requests (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  -- The trainer they'd like, if they have one in mind.
  trainer_id uuid references public.profiles (id) on delete set null,
  needs text[] not null check (cardinality(needs) between 1 and 8),
  comments text not null default '' check (length(comments) <= 500),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined', 'withdrawn')),
  response text not null default '' check (length(response) <= 500),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- One open request per member per gym.
create unique index trainer_requests_one_pending
  on public.trainer_requests (gym_id, member_id) where status = 'pending';

alter table public.trainer_requests enable row level security;

-- Writes go through the functions below.
create policy "Members and managers read requests" on public.trainer_requests
  for select using (member_id = auth.uid() or public.can_manage_gym(gym_id));

create function public.request_trainer(
  p_gym_id uuid, p_trainer_id uuid, p_needs text[], p_comments text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_member text;
  v_manager uuid;
begin
  if not public.has_gym_role(p_gym_id, array['member']) then
    raise exception 'Only members can ask for a trainer';
  end if;
  if p_trainer_id is not null and not exists (
    select 1 from public.gym_members
    where gym_id = p_gym_id and user_id = p_trainer_id and role = 'trainer' and status = 'active'
  ) then
    raise exception 'Pick a trainer from this gym';
  end if;
  if coalesce(cardinality(p_needs), 0) = 0 then
    raise exception 'Say what you need help with';
  end if;
  if exists (
    select 1 from public.trainer_requests
    where gym_id = p_gym_id and member_id = auth.uid() and status = 'pending'
  ) then
    raise exception 'You already have a request waiting';
  end if;

  insert into public.trainer_requests (gym_id, member_id, trainer_id, needs, comments)
  values (p_gym_id, auth.uid(), p_trainer_id, p_needs, trim(coalesce(p_comments, '')))
  returning id into v_id;

  select full_name into v_member from public.profiles where id = auth.uid();
  for v_manager in
    select user_id from public.gym_members
    where gym_id = p_gym_id and role in ('owner', 'supervisor') and status = 'active'
  loop
    perform public.notify(p_gym_id, v_manager, 'trainer_request', 'Trainer request',
      coalesce(v_member, 'A member') || ' asked for a trainer: ' || array_to_string(p_needs, ', ') || '.');
  end loop;
  return v_id;
end;
$$;

revoke execute on function public.request_trainer(uuid, uuid, text[], text) from public, anon;
grant execute on function public.request_trainer(uuid, uuid, text[], text) to authenticated;

create function public.withdraw_trainer_request(p_request_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.trainer_requests set status = 'withdrawn', resolved_at = now()
    where id = p_request_id and member_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'Request not found';
  end if;
end;
$$;

revoke execute on function public.withdraw_trainer_request(uuid) from public, anon;
grant execute on function public.withdraw_trainer_request(uuid) to authenticated;

-- Approving maps the member to p_trainer_id, which may differ from the one they asked for.
create function public.resolve_trainer_request(
  p_request_id uuid, p_approve boolean, p_trainer_id uuid, p_response text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_request public.trainer_requests;
  v_trainer text;
begin
  select * into v_request from public.trainer_requests where id = p_request_id for update;
  if not found or not public.can_manage_gym(v_request.gym_id) then
    raise exception 'Request not found';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This request was already answered';
  end if;
  if p_approve and p_trainer_id is null then
    raise exception 'Pick a trainer';
  end if;

  if p_approve then
    insert into public.member_trainers (gym_id, member_id, trainer_id)
    values (v_request.gym_id, v_request.member_id, p_trainer_id)
    on conflict do nothing;
  end if;

  update public.trainer_requests
    set status = case when p_approve then 'approved' else 'declined' end,
        trainer_id = case when p_approve then p_trainer_id else trainer_id end,
        response = trim(coalesce(p_response, '')),
        resolved_by = auth.uid(),
        resolved_at = now()
    where id = p_request_id;

  select full_name into v_trainer from public.profiles where id = p_trainer_id;
  perform public.notify(v_request.gym_id, v_request.member_id, 'trainer_request',
    case when p_approve then 'Trainer request approved' else 'Trainer request declined' end,
    case
      when p_approve then coalesce(v_trainer, 'Your new trainer') || ' will train you.'
      else 'Your gym couldn''t match a trainer this time.'
    end || case when trim(coalesce(p_response, '')) <> '' then ' ' || trim(p_response) else '' end);
end;
$$;

revoke execute on function public.resolve_trainer_request(uuid, boolean, uuid, text) from public, anon;
grant execute on function public.resolve_trainer_request(uuid, boolean, uuid, text) to authenticated;

-- Classes: trainers schedule their own --------------------------------------------

create policy "Trainers manage their classes" on public.classes
  for all using (trainer_id = auth.uid() and public.has_gym_role(gym_id, array['trainer']))
  with check (trainer_id = auth.uid() and public.has_gym_role(gym_id, array['trainer']));

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
    where class_id = any (v_ids) and status = 'booked';
  return coalesce(array_length(v_ids, 1), 0);
end;
$$;
