-- Owners and supervisors cover for missing roles.
--
-- Small gyms often have no supervisor or no trainer, so staff roles now nest:
--   owner       can do everything a supervisor and a trainer can
--   supervisor  can do everything a trainer can
-- They coach under their own name: set bookable hours, write plans, be mapped
-- to members, schedule their own classes and hear when their members train.
-- "Coach" below means anyone who can train members: a trainer, supervisor or owner.
-- Owner-only powers (roles, removing people, editing gym plans) stay owner-only.

-- A role check for the caller, with owner ⊇ supervisor ⊇ trainer. Member is
-- never implied: staff log workouts but don't book trainers or classes as members.
create or replace function public.has_gym_role(p_gym_id uuid, p_roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.gym_members
    where gym_id = p_gym_id and user_id = auth.uid() and status = 'active'
      and (
        role = any (p_roles)
        or (role = 'owner' and p_roles && array['supervisor', 'trainer'])
        or (role = 'supervisor' and 'trainer' = any (p_roles))
      )
  )
$$;

-- True when p_user_id can coach members at this gym.
create function public.is_coach(p_gym_id uuid, p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.gym_members
    where gym_id = p_gym_id and user_id = p_user_id and status = 'active'
      and role in ('trainer', 'supervisor', 'owner')
  )
$$;

-- Internal: used by the checks below, not callable from the app.
revoke execute on function public.is_coach(uuid, uuid) from public, anon, authenticated;

-- A class's trainer can be any coach at that gym.
create or replace function public.check_class_trainer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.trainer_id is not null and not public.is_coach(new.gym_id, new.trainer_id) then
    raise exception 'Pick a trainer from this gym';
  end if;
  if tg_op = 'UPDATE' and new.capacity < old.capacity and new.capacity < (
    select count(*) from public.bookings where class_id = new.id and status = 'booked'
  ) then
    raise exception 'More people have booked than the new capacity';
  end if;
  return new;
end;
$$;

-- Members can be mapped to any coach.
create or replace function public.check_member_trainer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.gym_members
    where gym_id = new.gym_id and user_id = new.member_id and role = 'member' and status = 'active'
  ) then
    raise exception 'Pick an active member of this gym';
  end if;
  if not public.is_coach(new.gym_id, new.trainer_id) then
    raise exception 'Pick a trainer from this gym';
  end if;
  return new;
end;
$$;

-- A role change only ends the links that no longer fit: someone who stops being
-- a member loses their trainers, and someone who can no longer coach loses their
-- members. An owner made supervisor, say, keeps coaching their members.
create or replace function public.drop_trainer_links() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    delete from public.member_trainers
      where gym_id = old.gym_id and (member_id = old.user_id or trainer_id = old.user_id);
  elsif new.role <> old.role then
    delete from public.member_trainers
      where gym_id = old.gym_id
        and (member_id = old.user_id
             or (trainer_id = old.user_id and new.role not in ('trainer', 'supervisor', 'owner')));
  end if;
  return coalesce(new, old);
end;
$$;

-- Owners and supervisors message any other coach, e.g. about a class they teach.
create or replace function public.message_trainer(
  p_gym_id uuid, p_trainer_id uuid, p_title text, p_body text, p_class_id uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_gym(p_gym_id) then
    raise exception 'Only owners and supervisors can message trainers';
  end if;
  if p_trainer_id = auth.uid() or not public.is_coach(p_gym_id, p_trainer_id) then
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

-- Members may ask for any coach by name.
create or replace function public.request_trainer(
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
  if p_trainer_id is not null and not public.is_coach(p_gym_id, p_trainer_id) then
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

-- Every coach mapped to the member hears about their workouts, owners included.
create or replace function public.tell_member_trainers(
  p_gym_id uuid, p_member_id uuid, p_title text, p_body text, p_dedupe_key text
) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (gym_id, recipient_id, sender_id, kind, title, body, dedupe_key)
  select p_gym_id, mt.trainer_id, p_member_id, 'attendance', left(p_title, 80), left(p_body, 500), p_dedupe_key
  from public.member_trainers mt
  where mt.gym_id = p_gym_id and mt.member_id = p_member_id
    and public.is_coach(mt.gym_id, mt.trainer_id)
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing
$$;
