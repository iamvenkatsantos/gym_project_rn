-- Member onboarding and admissions.
--
-- Trainers can now invite people too, but only as members of their own branch,
-- and a member a trainer invites is mapped to that trainer. Owners and
-- supervisors invite as before.
--
-- Inviting a member is their admission: whoever sent the invite (owner,
-- supervisor or trainer) and when is kept on the membership as admitted_by
-- and admitted_at, for owners and supervisors to see.
--
-- On first sign-in a member fills in their name, phone, weight and height and
-- adds a front, side and back photo before they can use the app. Weight and
-- height become their first body measurement, and the photos their first
-- progress photos (both from 20261026131500_body_progress). The phone number
-- lives in contact_details, which only the member, their gym's managers and
-- their trainers can read, not every gym-mate.

-- Admission and onboarding --------------------------------------------------------

alter table public.gym_members
  add column admitted_by uuid references public.profiles (id) on delete set null,
  add column admitted_at timestamptz,
  add column onboarded_at timestamptz;

-- Nobody knows who invited the members already here; their join date stands in.
update public.gym_members set admitted_at = joined_at where role = 'member';

-- Members already using the app fill in the form on their next sign-in too.
-- Staff never see it.
update public.gym_members set onboarded_at = joined_at where role <> 'member';

-- Owners can update memberships directly, but an admission is a record of what
-- happened, so it never changes after the row is created.
create function public.keep_admission() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.admitted_by := old.admitted_by;
  new.admitted_at := old.admitted_at;
  return new;
end;
$$;

create trigger gym_members_keep_admission
  before update on public.gym_members
  for each row execute function public.keep_admission();

-- Phone numbers ---------------------------------------------------------------------

create table public.contact_details (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  phone text not null check (phone ~ '^\+?[0-9]{7,15}$'),
  updated_at timestamptz not null default now()
);

alter table public.contact_details enable row level security;

-- Writes go through complete_member_onboarding().
revoke insert, update, delete on public.contact_details from authenticated, anon;

create policy "Read your own, your gym's or your members' contact details"
  on public.contact_details for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.gym_members gm
      where gm.user_id = contact_details.user_id and public.can_manage_gym(gm.gym_id)
    )
    or exists (
      select 1 from public.member_trainers mt
      where mt.member_id = contact_details.user_id and mt.trainer_id = auth.uid()
    )
  );

-- Invites ---------------------------------------------------------------------------

-- Owners invite anyone but owners (admins do that), supervisors invite members
-- and trainers, and trainers invite members. Trainers are checked on the exact
-- role, so they only invite to the branch they work at.
create or replace function public.invite_to_gym(p_gym_id uuid, p_email text, p_role text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
  v_user_id uuid;
  v_manager boolean := public.can_manage_gym(p_gym_id) or public.is_platform_admin();
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
  if p_role = 'owner' and not public.is_platform_admin() then
    raise exception 'Only CoreFit Gym admins can add an owner';
  end if;
  if p_role = 'supervisor' and not public.has_gym_role(p_gym_id, array['owner'])
     and not public.is_platform_admin() then
    raise exception 'Only owners can invite supervisors and owners';
  end if;
  if v_email not like '%_@_%' then
    raise exception 'Enter a valid email address';
  end if;

  select id into v_user_id from auth.users
    where lower(email) = v_email and email_confirmed_at is not null;

  if v_user_id is not null then
    insert into public.gym_members (gym_id, user_id, role, admitted_by, admitted_at)
    values (
      p_gym_id, v_user_id, p_role,
      case when p_role = 'member' then auth.uid() end,
      case when p_role = 'member' then now() end
    )
    on conflict (gym_id, user_id) do nothing;
    if not found then
      return 'already_member';
    end if;
    if not v_manager then
      insert into public.member_trainers (gym_id, member_id, trainer_id, assigned_by)
      values (p_gym_id, v_user_id, auth.uid(), auth.uid())
      on conflict do nothing;
    end if;
    return 'added';
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
  return 'invited';
end;
$$;

-- Claiming an invite records the admission, and maps a member a trainer
-- invited to that trainer.
create or replace function public.claim_gym_invites() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is null or new.email is null then
    return new;
  end if;
  insert into public.gym_members (gym_id, user_id, role, admitted_by, admitted_at)
    select gym_id, new.id, role,
           case when role = 'member' then invited_by end,
           case when role = 'member' then created_at end
    from public.gym_invites where email = lower(new.email)
    on conflict (gym_id, user_id) do nothing;
  insert into public.member_trainers (gym_id, member_id, trainer_id, assigned_by)
    select i.gym_id, new.id, i.invited_by, i.invited_by
    from public.gym_invites i
    join public.gym_members inviter
      on inviter.gym_id = i.gym_id and inviter.user_id = i.invited_by
    where i.email = lower(new.email) and i.role = 'member'
      and inviter.role = 'trainer' and inviter.status = 'active'
      and exists (
        select 1 from public.gym_members gm
        where gm.gym_id = i.gym_id and gm.user_id = new.id
          and gm.role = 'member' and gm.status = 'active'
      )
    on conflict do nothing;
  delete from public.gym_invites where email = lower(new.email);
  return new;
end;
$$;

-- Trainers see and withdraw the invites they sent.
create policy "Trainers read their invites" on public.gym_invites
  for select using (invited_by = auth.uid() and public.has_gym_role(gym_id, array['trainer']));
create policy "Trainers withdraw their invites" on public.gym_invites
  for delete using (invited_by = auth.uid() and public.has_gym_role(gym_id, array['trainer']));

-- People ----------------------------------------------------------------------------

drop function public.gym_people(uuid);

create function public.gym_people(p_gym_id uuid)
returns table (
  user_id uuid, full_name text, email text, role text, status text, joined_at timestamptz,
  phone text, admitted_by uuid, admitted_by_name text, admitted_at timestamptz,
  onboarded_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select gm.user_id, p.full_name, u.email::text, gm.role, gm.status, gm.joined_at,
         cd.phone, gm.admitted_by, admitter.full_name, gm.admitted_at, gm.onboarded_at
  from public.gym_members gm
  join public.profiles p on p.id = gm.user_id
  join auth.users u on u.id = gm.user_id
  left join public.contact_details cd on cd.user_id = gm.user_id
  left join public.profiles admitter on admitter.id = gm.admitted_by
  where gm.gym_id = p_gym_id and public.can_manage_gym(p_gym_id)
  order by p.full_name
$$;

revoke execute on function public.gym_people(uuid) from public, anon;
grant execute on function public.gym_people(uuid) to authenticated;

-- Onboarding ------------------------------------------------------------------------

-- The member's first-sign-in form. The photos are uploaded first, the usual way;
-- this checks there's one of each pose, then saves the rest in one go.
create function public.complete_member_onboarding(
  p_gym_id uuid, p_full_name text, p_phone text, p_weight_kg numeric, p_height_cm numeric
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := trim(coalesce(p_full_name, ''));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[\s()-]', '', 'g');
  v_missing text;
begin
  if not exists (
    select 1 from public.gym_members
    where gym_id = p_gym_id and user_id = auth.uid() and role = 'member' and status = 'active'
  ) then
    raise exception 'Only members of this gym fill in this form';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Enter your full name';
  end if;
  if v_phone !~ '^\+?[0-9]{7,15}$' then
    raise exception 'Enter a valid phone number';
  end if;
  if p_weight_kg is null or p_weight_kg not between 20 and 300 then
    raise exception 'Enter your weight from 20 to 300 kg';
  end if;
  if p_height_cm is null or p_height_cm not between 100 and 250 then
    raise exception 'Enter your height from 100 to 250 cm';
  end if;
  select string_agg(pose, ', ' order by ord) into v_missing
    from unnest(array['front', 'side', 'back']) with ordinality as poses (pose, ord)
    where not exists (
      select 1 from public.progress_photos ph
      where ph.gym_id = p_gym_id and ph.member_id = auth.uid() and ph.pose = poses.pose
    );
  if v_missing is not null then
    raise exception 'Add your % photo', v_missing;
  end if;

  update public.profiles set full_name = v_name where id = auth.uid();
  insert into public.contact_details (user_id, phone) values (auth.uid(), v_phone)
    on conflict (user_id) do update set phone = excluded.phone, updated_at = now();
  insert into public.body_measurements (gym_id, member_id, measured_on, weight_kg, height_cm)
    values (p_gym_id, auth.uid(), public.gym_day(p_gym_id), p_weight_kg, p_height_cm)
    on conflict (gym_id, member_id, measured_on) do update
      set weight_kg = excluded.weight_kg, height_cm = excluded.height_cm, updated_at = now();
  update public.gym_members set onboarded_at = now()
    where gym_id = p_gym_id and user_id = auth.uid();
end;
$$;

revoke execute on function public.complete_member_onboarding(uuid, text, text, numeric, numeric)
  from public, anon;
grant execute on function public.complete_member_onboarding(uuid, text, text, numeric, numeric)
  to authenticated;

-- Reports ---------------------------------------------------------------------------

-- The memberships export gains the member's phone and their admission.
drop function public.export_memberships(uuid);

create function public.export_memberships(p_gym_id uuid)
returns table (
  member_name text, member_email text, joined_on date, plan_name text,
  starts_on date, ends_on date, amount_paid_cents int, currency text, payment_method text,
  phone text, admitted_by text, admitted_on date
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := public.gym_day(p_gym_id);
begin
  perform public.check_report_access(p_gym_id, v_today, v_today);
  return query
    select p.full_name, u.email::text, public.gym_day(p_gym_id, gm.joined_at), latest.plan_name,
           latest.starts_on, latest.ends_on, latest.amount_paid_cents, latest.currency,
           latest.payment_method, cd.phone, admitter.full_name,
           public.gym_day(p_gym_id, gm.admitted_at)
    from public.gym_members gm
    join public.profiles p on p.id = gm.user_id
    left join auth.users u on u.id = gm.user_id
    left join public.contact_details cd on cd.user_id = gm.user_id
    left join public.profiles admitter on admitter.id = gm.admitted_by
    left join lateral (
      select mp.name as plan_name, m.starts_on, m.ends_on, m.amount_paid_cents, mp.currency,
             m.payment_method
      from public.memberships m
      join public.membership_plans mp on mp.id = m.plan_id
      where m.member_id = gm.user_id and mp.gym_id = p_gym_id
      order by m.ends_on desc, m.created_at desc
      limit 1
    ) latest on true
    where gm.gym_id = p_gym_id and gm.status = 'active' and gm.role = 'member'
    order by latest.ends_on nulls first, p.full_name;
end;
$$;

revoke execute on function public.export_memberships(uuid) from public, anon;
grant execute on function public.export_memberships(uuid) to authenticated;
