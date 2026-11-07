-- Referrals reach the people who can act on them (Venkat, 2026-11-07):
--   * A new referral pushes the branch's owners and supervisors and the referring member's own
--     trainers, and the notification carries the friend's mobile so the inbox shows a Call button.
--   * Owners, supervisors and trainers see recent referrals (last 14 days) on a Referrals list.
--     Trainers see only referrals from members they train.

-- A number the inbox can call, e.g. the friend a member referred.
alter table public.notifications
  add column phone text check (phone is null or phone ~ '^\+?[0-9]{7,15}$');

create or replace function public.refer_friend(p_gym_id uuid, p_full_name text, p_phone text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[\s()-]', '', 'g');
  v_assignee uuid;
  v_me text;
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

  -- Owners, supervisors and the member's own trainers, once each.
  insert into public.notifications (gym_id, recipient_id, sender_id, kind, title, body, phone)
  select p_gym_id, r.user_id, auth.uid(), 'message', 'New referral',
         left(coalesce(nullif(trim(v_me), ''), 'A member') || ' referred ' || v_name || '. Call ' || v_phone || '.', 500),
         v_phone
  from (
    select gm.user_id from public.gym_members gm
    where gm.gym_id = p_gym_id and gm.status = 'active' and gm.role in ('owner', 'supervisor')
    union
    select mt.trainer_id from public.member_trainers mt
    join public.gym_members gm on gm.gym_id = mt.gym_id and gm.user_id = mt.trainer_id and gm.status = 'active'
    where mt.gym_id = p_gym_id and mt.member_id = auth.uid()
  ) r;
  return v_id;
end;
$$;

-- Referrals made in the last p_days days at this branch, newest first. Owners and
-- supervisors see all; trainers only those from members they train.
create function public.gym_referrals(p_gym_id uuid, p_days int default 14)
returns table (
  id uuid, full_name text, phone text, referred_by_name text, status text, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_manager boolean := public.can_manage_gym(p_gym_id);
begin
  if not v_manager and not public.has_gym_role(p_gym_id, array['trainer']) then
    raise exception 'Only staff see referrals';
  end if;
  return query
  select e.id, e.full_name, e.phone, coalesce(p.full_name, 'A member'),
         case when r.id is not null or e.status = 'joined' then 'joined'
              when e.status = 'lost' then 'closed' else 'pending' end,
         e.created_at
  from public.enquiries e
  left join public.profiles p on p.id = e.referred_by
  left join public.referral_rewards r on r.enquiry_id = e.id
  where e.gym_id = p_gym_id and e.referred_by is not null
    and e.created_at > now() - make_interval(days => greatest(least(coalesce(p_days, 14), 90), 1))
    and (v_manager or exists (
      select 1 from public.member_trainers mt
      where mt.gym_id = p_gym_id and mt.member_id = e.referred_by and mt.trainer_id = auth.uid()
    ))
  order by e.created_at desc;
end;
$$;

revoke execute on function public.gym_referrals(uuid, int) from public, anon;
grant execute on function public.gym_referrals(uuid, int) to authenticated;
