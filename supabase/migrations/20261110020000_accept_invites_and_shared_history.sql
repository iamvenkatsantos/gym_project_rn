-- People with an account accept a gym's invite, and their history can follow them (#116).
--
-- Before, inviting an email or mobile that already had a confirmed account added that
-- person to the gym straight away, without asking them. Now they get a pending invite
-- (result 'invited_in_app'), a push and a card in the app, and join only when they tap
-- Join. On joining they choose whether the new gym's coaches may see the workouts,
-- measurements and progress photos they logged at other gyms (Share my history, off by
-- default, changeable later). Members always see their own history from every gym.
-- Platform admins still add people straight away.

-- History sharing ---------------------------------------------------------------------

alter table public.gym_members
  add column if not exists history_shared boolean not null default false;

-- The old rule, for logs at one gym: the person, the gym's owners, its supervisors (for
-- members and trainers there) and the member's mapped trainers.
create function public.can_view_logs_at(p_gym_id uuid, p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_user_id = auth.uid()
    or public.has_gym_role(p_gym_id, array['owner'])
    or (
      public.has_gym_role(p_gym_id, array['supervisor'])
      and exists (
        select 1 from public.gym_members
        where gym_id = p_gym_id and user_id = p_user_id and role in ('member', 'trainer')
      )
    )
    or (
      public.has_gym_role(p_gym_id, array['trainer'])
      and exists (
        select 1 from public.member_trainers
        where gym_id = p_gym_id and member_id = p_user_id and trainer_id = auth.uid()
      )
    )
$$;

revoke execute on function public.can_view_logs_at(uuid, uuid) from public, anon, authenticated;

-- Logs at any gym are also visible to whoever may see the person's logs at a gym they
-- share their history with. Used by workout_logs, workout_log_sets, body_measurements,
-- progress_photos and the progress-photos bucket.
create or replace function public.can_view_workout_logs(p_gym_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_view_logs_at(p_gym_id, p_user_id)
    or exists (
      select 1 from public.gym_members gm
      where gm.user_id = p_user_id and gm.history_shared and gm.status = 'active'
        and gm.gym_id <> p_gym_id
        and public.can_view_logs_at(gm.gym_id, p_user_id)
    )
$$;

-- The gyms behind someone's history the caller may see, to label it ("At Pulse Gym").
-- Members can't read other gyms' rows in gyms, so the names come from here.
create function public.history_gyms(p_member_id uuid)
returns table (gym_id uuid, gym_name text)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name
  from public.gyms g
  where g.id in (
    select l.gym_id from public.workout_logs l where l.member_id = p_member_id
    union
    select m.gym_id from public.body_measurements m where m.member_id = p_member_id
    union
    select ph.gym_id from public.progress_photos ph where ph.member_id = p_member_id
  )
  and public.can_view_workout_logs(g.id, p_member_id)
$$;

revoke execute on function public.history_gyms(uuid) from public, anon;
grant execute on function public.history_gyms(uuid) to authenticated;

-- A member turns sharing with one of their gyms on or off.
create function public.set_history_sharing(p_gym_id uuid, p_share boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.gym_members
    set history_shared = coalesce(p_share, false)
    where gym_id = p_gym_id and user_id = auth.uid();
  if not found then
    raise exception 'You aren''t at this gym';
  end if;
end;
$$;

revoke execute on function public.set_history_sharing(uuid, boolean) from public, anon;
grant execute on function public.set_history_sharing(uuid, boolean) to authenticated;

-- Members keep reading diet plans assigned to them at any gym, not only where they're a
-- member now.
drop policy if exists "Read meal plans" on public.meal_plans;
create policy "Read meal plans" on public.meal_plans
  for select using (
    (coach_id = auth.uid() and public.has_gym_role(gym_id, array['trainer']))
    or public.can_manage_gym(gym_id)
    or exists (
      select 1 from public.meal_plan_assignments a
      where a.plan_id = meal_plans.id and a.member_id = auth.uid()
    )
  );

create or replace function public.can_view_meal_plan(p_plan_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.meal_plans p
    where p.id = p_plan_id
      and (
        public.can_edit_meal_plan(p.id)
        or public.can_manage_gym(p.gym_id)
        or exists (
          select 1 from public.meal_plan_assignments a
          where a.plan_id = p.id and a.member_id = auth.uid()
        )
      )
  )
$$;

-- Invites for people who already have an account --------------------------------------

-- New inbox kind 'invite'; keep whatever kinds the check already allows.
do $$
declare
  v_name text;
  v_def text;
  v_kinds text[];
begin
  select conname, pg_get_constraintdef(oid) into v_name, v_def
  from pg_constraint
  where conrelid = 'public.notifications'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%kind%';
  if v_name is null then
    return;
  end if;
  select array_agg(distinct m[1]) into v_kinds
  from regexp_matches(v_def, '([a-z_]+)', 'g') as m
  where m[1] not in ('check', 'kind', 'any', 'array', 'text');
  if 'invite' = any (v_kinds) then
    return;
  end if;
  execute format('alter table public.notifications drop constraint %I', v_name);
  execute format(
    'alter table public.notifications add constraint %I check (kind = any (%L::text[]))',
    v_name, array_append(v_kinds, 'invite')
  );
end;
$$;

create or replace function public.invite_to_gym(p_gym_id uuid, p_email text, p_role text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
  v_user_id uuid;
  v_admin boolean := public.is_platform_admin();
  v_manager boolean := public.can_manage_gym(p_gym_id) or v_admin;
  v_gym text;
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
    if exists (select 1 from public.gym_members where gym_id = p_gym_id and user_id = v_user_id) then
      return 'already_member';
    end if;
    -- Platform admins set people up directly (new owners and fixes).
    if v_admin then
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

-- Open invites for the signed-in person's account (gyms they aren't at yet).
create function public.my_gym_invites()
returns table (
  id uuid, gym_id uuid, gym_name text, gym_city text, role text, invited_by_name text,
  created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select i.id, i.gym_id, g.name, g.city, i.role, p.full_name, i.created_at
  from public.gym_invites i
  join auth.users u on lower(u.email) = i.email
  join public.gyms g on g.id = i.gym_id
  left join public.profiles p on p.id = i.invited_by
  where u.id = auth.uid() and u.email_confirmed_at is not null
    and not exists (
      select 1 from public.gym_members gm where gm.gym_id = i.gym_id and gm.user_id = u.id
    )
  order by i.created_at desc
$$;

revoke execute on function public.my_gym_invites() from public, anon;
grant execute on function public.my_gym_invites() to authenticated;

-- Joins the gym from one of the caller's invites, as claim_gym_invites() does for a new
-- account, and records whether they share their history with it. Returns the gym's id.
create function public.accept_gym_invite(p_invite_id uuid, p_share_history boolean)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_invite public.gym_invites;
  v_user uuid := auth.uid();
begin
  select i.* into v_invite
  from public.gym_invites i
  join auth.users u on lower(u.email) = i.email
  where i.id = p_invite_id and u.id = v_user and u.email_confirmed_at is not null
  for update of i;
  if not found then
    raise exception 'This invite is no longer open';
  end if;

  insert into public.gym_members (
    gym_id, user_id, role, admitted_by, admitted_at, history_shared
  ) values (
    v_invite.gym_id, v_user, v_invite.role,
    case when v_invite.role = 'member' then v_invite.invited_by end,
    case when v_invite.role = 'member' then v_invite.created_at end,
    coalesce(p_share_history, false)
  )
  on conflict (gym_id, user_id) do nothing;

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

revoke execute on function public.accept_gym_invite(uuid, boolean) from public, anon;
grant execute on function public.accept_gym_invite(uuid, boolean) to authenticated;

create function public.decline_gym_invite(p_invite_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.gym_invites i
  using auth.users u
  where i.id = p_invite_id and u.id = auth.uid() and lower(u.email) = i.email;
  if not found then
    raise exception 'This invite is no longer open';
  end if;
end;
$$;

revoke execute on function public.decline_gym_invite(uuid) from public, anon;
grant execute on function public.decline_gym_invite(uuid) to authenticated;
