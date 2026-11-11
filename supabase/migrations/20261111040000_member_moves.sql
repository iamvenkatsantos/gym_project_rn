-- Members move between gyms, and one person keeps one role (Venkat, 2026-11-11).
--
-- Joining Gym B from an invite moves the person out of every other gym where they're a
-- member, trainer or supervisor (owners keep the branches the admin gave them): that row
-- becomes 'moved' (no access, like suspended, but only a new invite brings them back).
-- Members' memberships there end the day before, and their trainer links, upcoming
-- bookings and trainer requests there go; trainers lose their member links and upcoming
-- one-to-one sessions there. The app warns about the membership days left first.
-- Coming back takes a new invite and a new membership. The old gym lists who moved out
-- (gym_moved_members()), without saying where to.
--
-- Roles: someone who holds a role at a gym can only be invited with that same role
-- elsewhere (a trainer at Gym A can't join Gym B as a member). Platform admins are exempt.

alter table public.gym_members drop constraint gym_members_status_check;
alter table public.gym_members add constraint gym_members_status_check
  check (status in ('invited', 'active', 'suspended', 'moved'));

alter table public.gym_members
  add column if not exists moved_at timestamptz,
  add column if not exists moved_days_left int;

-- Only accept_gym_invite() moves people or brings them back; owners can't reactivate a
-- moved row or mark someone moved.
create function public.guard_moved_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status
     and (old.status = 'moved' or new.status = 'moved')
     and auth.uid() is not null and not public.is_platform_admin()
     and coalesce(current_setting('corefit.moving', true), '') <> 'on' then
    raise exception 'They moved to another gym. Invite them again to bring them back.';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_moved_status() from public, anon, authenticated;

create trigger gym_members_guard_moved before update of status on public.gym_members
  for each row execute function public.guard_moved_status();

-- No new membership for someone who moved out.
create function public.refuse_moved_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.membership_plans mp
    join public.gym_members gm on gm.gym_id = mp.gym_id and gm.user_id = new.member_id
    where mp.id = new.plan_id and gm.status = 'moved'
  ) then
    raise exception 'They moved to another gym. Invite them again first.';
  end if;
  return new;
end;
$$;

revoke execute on function public.refuse_moved_membership() from public, anon, authenticated;

create trigger memberships_refuse_moved before insert on public.memberships
  for each row execute function public.refuse_moved_membership();

-- Membership days still to come at a gym (today included, the gym's day).
create function public.membership_days_left(p_gym_id uuid, p_user_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(m.ends_on - greatest(m.starts_on, public.gym_day(p_gym_id)) + 1), 0)::int
  from public.memberships m
  join public.membership_plans mp on mp.id = m.plan_id
  where mp.gym_id = p_gym_id and m.member_id = p_user_id
    and m.ends_on >= public.gym_day(p_gym_id)
$$;

revoke execute on function public.membership_days_left(uuid, uuid) from public, anon, authenticated;

-- The role someone already holds at another gym, if any (not counting moved rows).
create function public.role_elsewhere(p_user_id uuid, p_gym_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select gm.role from public.gym_members gm
  where gm.user_id = p_user_id and gm.gym_id <> p_gym_id and gm.status <> 'moved'
  order by case gm.role when 'owner' then 1 when 'supervisor' then 2 when 'trainer' then 3 else 4 end
  limit 1
$$;

revoke execute on function public.role_elsewhere(uuid, uuid) from public, anon, authenticated;

create function public.role_conflict_message(p_role text) returns text
language sql immutable set search_path = '' as $$
  select 'They''re ' || case p_role when 'owner' then 'an owner' else 'a ' || p_role end
    || ' at another gym, so they can only join as '
    || case p_role when 'owner' then 'an owner' else 'a ' || p_role end || '.'
$$;

revoke execute on function public.role_conflict_message(text) from public, anon, authenticated;

-- Moves someone out of every other gym where they aren't an owner.
create function public.move_out(p_user_id uuid, p_to_gym_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_row record;
  v_day date;
  v_tz text;
begin
  perform set_config('corefit.moving', 'on', true);
  for v_row in
    select gm.gym_id, gm.role from public.gym_members gm
    where gm.user_id = p_user_id and gm.gym_id <> p_to_gym_id
      and gm.role <> 'owner' and gm.status <> 'moved'
    for update
  loop
    v_day := public.gym_day(v_row.gym_id);
    select time_zone into v_tz from public.gyms where id = v_row.gym_id;

    update public.gym_members
      set status = 'moved', moved_at = now(),
          moved_days_left = public.membership_days_left(v_row.gym_id, p_user_id)
      where gym_id = v_row.gym_id and user_id = p_user_id;

    -- Their membership there stops: it ends yesterday (gym's day), so it never counts again.
    update public.memberships m
      set starts_on = least(m.starts_on, v_day - 1),
          ends_on = v_day - 1,
          note = left(trim(m.note || ' Ended ' || to_char(v_day, 'DD Mon YYYY')
                 || ': moved to another gym.'), 500)
      from public.membership_plans mp
      where mp.id = m.plan_id and mp.gym_id = v_row.gym_id and m.member_id = p_user_id
        and m.ends_on >= v_day;
    delete from public.membership_pauses
      where gym_id = v_row.gym_id and member_id = p_user_id and starts_on >= v_day;

    delete from public.member_trainers
      where gym_id = v_row.gym_id and (member_id = p_user_id or trainer_id = p_user_id);
    update public.trainer_sessions s set status = 'cancelled'
      where s.gym_id = v_row.gym_id and s.trainer_id = p_user_id and s.status = 'booked'
        and s.starts_at > now();
    delete from public.trainer_requests
      where gym_id = v_row.gym_id and member_id = p_user_id and status = 'pending';
    update public.bookings b set status = 'cancelled'
      from public.classes c
      where c.id = b.class_id and c.gym_id = v_row.gym_id and b.member_id = p_user_id
        and b.status in ('booked', 'waitlisted') and c.starts_at > now();
    update public.trainer_sessions s set status = 'cancelled'
      where s.gym_id = v_row.gym_id and s.member_id = p_user_id and s.status = 'booked'
        and s.starts_at > now();
  end loop;
  perform set_config('corefit.moving', '', true);
end;
$$;

revoke execute on function public.move_out(uuid, uuid) from public, anon, authenticated;

-- Invites ----------------------------------------------------------------------------

create or replace function public.invite_to_gym(p_gym_id uuid, p_email text, p_role text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
  v_user_id uuid;
  v_admin boolean := public.is_platform_admin();
  v_manager boolean := public.can_manage_gym(p_gym_id) or v_admin;
  v_gym text;
  v_other text;
begin
  if not v_manager and not public.has_gym_role(p_gym_id, array['trainer']) then
    raise exception 'Only owners, supervisors and trainers can invite people';
  end if;
  if p_role not in ('member', 'trainer', 'supervisor', 'owner') then
    raise exception 'Unknown role';
  end if;
  if not v_manager and p_role <> 'member' then
    raise exception 'Trainers can invite members only';
  end if;
  if p_role = 'owner' and not v_admin then
    raise exception 'Only CoreFit Gym admins can add an owner';
  end if;
  if p_role = 'supervisor' and not public.has_gym_role(p_gym_id, array['owner'])
     and not v_admin then
    raise exception 'Only owners can invite supervisors and owners';
  end if;
  if v_email not like '%_@_%' then
    raise exception 'Enter a valid email address';
  end if;

  select id into v_user_id from auth.users
    where lower(email) = v_email and email_confirmed_at is not null;

  if v_user_id is not null then
    if exists (
      select 1 from public.gym_members
      where gym_id = p_gym_id and user_id = v_user_id and status <> 'moved'
    ) then
      return 'already_member';
    end if;
    -- One person, one role: a trainer at another gym joins here as a trainer too.
    v_other := public.role_elsewhere(v_user_id, p_gym_id);
    if v_other is not null and v_other <> p_role and not v_admin then
      raise exception '%', public.role_conflict_message(v_other);
    end if;
    -- Roles never change, so someone who moved out comes back with the role they had.
    if exists (
      select 1 from public.gym_members
      where gym_id = p_gym_id and user_id = v_user_id and status = 'moved' and role <> p_role
    ) then
      raise exception 'They were here before with another role. Invite them with that role.';
    end if;
    -- Platform admins set people up directly (new owners and fixes).
    if v_admin and not exists (
      select 1 from public.gym_members where gym_id = p_gym_id and user_id = v_user_id
    ) then
      insert into public.gym_members (gym_id, user_id, role, admitted_by, admitted_at)
      values (
        p_gym_id, v_user_id, p_role,
        case when p_role = 'member' then auth.uid() end,
        case when p_role = 'member' then now() end
      )
      on conflict (gym_id, user_id) do nothing;
      return 'added';
    end if;
  end if;

  -- A trainer can't turn a manager's trainer or supervisor invite into a member one.
  if not v_manager and exists (
    select 1 from public.gym_invites
    where gym_id = p_gym_id and email = v_email and role <> 'member'
  ) then
    raise exception 'This email already has an invite from your gym';
  end if;

  -- Inviting again makes the latest inviter the one who admitted them.
  insert into public.gym_invites (gym_id, email, role, invited_by)
  values (p_gym_id, v_email, p_role, auth.uid())
  on conflict (gym_id, email) do update
    set role = excluded.role, invited_by = excluded.invited_by, created_at = now();

  if v_user_id is null then
    return 'invited';
  end if;

  -- They already use CoreFit: they accept it in the app (accept_gym_invite()).
  select name into v_gym from public.gyms where id = p_gym_id;
  insert into public.notifications (gym_id, recipient_id, sender_id, kind, title, body, dedupe_key)
  values (
    p_gym_id, v_user_id, auth.uid(), 'invite', 'Gym invite',
    left(coalesce(v_gym, 'A gym') || ' invited you to join. Open CoreFit to accept.', 500),
    'gym-invite:' || p_gym_id || ':' || now()::date
  )
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
  return 'invited_in_app';
end;
$$;

-- Open invites, with the gyms joining would move them out of and the membership days
-- they'd give up there.
drop function public.my_gym_invites();
create function public.my_gym_invites()
returns table (
  id uuid, gym_id uuid, gym_name text, gym_city text, role text, invited_by_name text,
  created_at timestamptz, leaving_gyms text, days_left int
)
language sql stable security definer set search_path = '' as $$
  select i.id, i.gym_id, g.name, g.city, i.role, p.full_name, i.created_at,
         leaving.names, coalesce(leaving.days, 0)
  from public.gym_invites i
  join auth.users u on lower(u.email) = i.email
  join public.gyms g on g.id = i.gym_id
  left join public.profiles p on p.id = i.invited_by
  left join lateral (
    select string_agg(og.name, ', ' order by og.name) as names,
           sum(public.membership_days_left(og.id, u.id))::int as days
    from public.gym_members gm
    join public.gyms og on og.id = gm.gym_id
    where gm.user_id = u.id and gm.gym_id <> i.gym_id
      and gm.role <> 'owner' and gm.status <> 'moved'
  ) leaving on true
  where u.id = auth.uid() and u.email_confirmed_at is not null
    and not exists (
      select 1 from public.gym_members gm
      where gm.gym_id = i.gym_id and gm.user_id = u.id and gm.status <> 'moved'
    )
  order by i.created_at desc
$$;

revoke execute on function public.my_gym_invites() from public, anon;
grant execute on function public.my_gym_invites() to authenticated;

create or replace function public.accept_gym_invite(p_invite_id uuid, p_share_history boolean)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_invite public.gym_invites;
  v_user uuid := auth.uid();
  v_other text;
begin
  select i.* into v_invite
  from public.gym_invites i
  join auth.users u on lower(u.email) = i.email
  where i.id = p_invite_id and u.id = v_user and u.email_confirmed_at is not null
  for update of i;
  if not found then
    raise exception 'This invite is no longer open';
  end if;

  v_other := public.role_elsewhere(v_user, v_invite.gym_id);
  if v_other is not null and v_other <> v_invite.role then
    raise exception '%', replace(
      public.role_conflict_message(v_other), 'They''re', 'You''re'
    );
  end if;

  perform public.move_out(v_user, v_invite.gym_id);

  -- Coming back to a gym they moved out of reopens their old row.
  perform set_config('corefit.moving', 'on', true);
  -- A member who filled in the first-sign-in form at another gym skips it here: their name,
  -- mobile, birthday, measurements and photos already follow them.
  insert into public.gym_members (
    gym_id, user_id, role, admitted_by, admitted_at, history_shared, onboarded_at
  ) values (
    v_invite.gym_id, v_user, v_invite.role,
    case when v_invite.role = 'member' then v_invite.invited_by end,
    case when v_invite.role = 'member' then v_invite.created_at end,
    coalesce(p_share_history, false),
    case when exists (
      select 1 from public.gym_members o
      where o.user_id = v_user and o.gym_id <> v_invite.gym_id and o.onboarded_at is not null
    ) then now() end
  )
  on conflict (gym_id, user_id) do update
    set status = 'active', moved_at = null, moved_days_left = null, joined_at = now(),
        history_shared = excluded.history_shared,
        onboarded_at = coalesce(public.gym_members.onboarded_at, excluded.onboarded_at)
    where public.gym_members.status = 'moved';
  perform set_config('corefit.moving', '', true);

  -- A trainer's member is mapped to them, as on sign-up.
  if v_invite.role = 'member' and exists (
    select 1 from public.gym_members inviter
    where inviter.gym_id = v_invite.gym_id and inviter.user_id = v_invite.invited_by
      and inviter.role = 'trainer' and inviter.status = 'active'
  ) then
    insert into public.member_trainers (gym_id, member_id, trainer_id, assigned_by)
    values (v_invite.gym_id, v_user, v_invite.invited_by, v_invite.invited_by)
    on conflict do nothing;
  end if;

  if v_invite.role = 'member' and v_invite.full_name is not null then
    perform public.apply_admission_details(
      v_invite.gym_id, v_user, v_invite.full_name, v_invite.phone, v_invite.date_of_birth,
      v_invite.weight_kg, v_invite.height_cm, v_invite.photo_paths
    );
  end if;

  delete from public.gym_invites where id = v_invite.id;
  return v_invite.gym_id;
end;
$$;

-- People lists ---------------------------------------------------------------------------

-- Moved people leave People; they show under Moved out instead.
create or replace function public.gym_people(p_gym_id uuid)
returns table (
  user_id uuid, full_name text, email text, role text, status text, joined_at timestamptz,
  phone text, admitted_by uuid, admitted_by_name text, admitted_at timestamptz,
  onboarded_at timestamptz, avatar_path text, signed_up boolean, date_of_birth date
)
language sql stable security definer set search_path = '' as $$
  select gm.user_id, p.full_name, u.email::text, gm.role, gm.status, gm.joined_at,
         cd.phone, gm.admitted_by, admitter.full_name, gm.admitted_at, gm.onboarded_at,
         p.avatar_path, u.email_confirmed_at is not null, cd.date_of_birth
  from public.gym_members gm
  join public.profiles p on p.id = gm.user_id
  join auth.users u on u.id = gm.user_id
  left join public.contact_details cd on cd.user_id = gm.user_id
  left join public.profiles admitter on admitter.id = gm.admitted_by
  where gm.gym_id = p_gym_id and gm.status <> 'moved' and public.can_manage_gym(p_gym_id)
  order by p.full_name
$$;

-- Who moved out of this gym, newest first, for its owners and supervisors.
create function public.gym_moved_members(p_gym_id uuid)
returns table (
  user_id uuid, full_name text, phone text, moved_at timestamptz, days_left int
)
language sql stable security definer set search_path = '' as $$
  select gm.user_id, p.full_name, cd.phone, gm.moved_at, coalesce(gm.moved_days_left, 0)
  from public.gym_members gm
  join public.profiles p on p.id = gm.user_id
  left join public.contact_details cd on cd.user_id = gm.user_id
  where gm.gym_id = p_gym_id and gm.status = 'moved' and public.can_manage_gym(p_gym_id)
  order by gm.moved_at desc nulls last
$$;

revoke execute on function public.gym_moved_members(uuid) from public, anon;
grant execute on function public.gym_moved_members(uuid) to authenticated;
