-- Admission details from the inviter.
--
-- Whoever invites a member (owner, supervisor or trainer) can fill in the same
-- details the member's first-sign-in form asks for: name, mobile, date of
-- birth, weight and height. They're kept on the invite until the member joins,
-- then saved to the member's profile, contact details and first body
-- measurement, and the member counts as onboarded, so they sign in straight to
-- Home. Without them the member fills in the form as before. Starting photos
-- stay with the member: they add them from Progress whenever they like.
--
-- The inviter's details never overwrite what the person already gave: an
-- existing name, mobile or date of birth stays.

alter table public.gym_invites
  add column full_name text check (char_length(full_name) between 2 and 80),
  add column date_of_birth date check (date_of_birth >= date '1900-01-01'),
  add column weight_kg numeric(5, 2) check (weight_kg between 20 and 300),
  add column height_cm numeric(4, 1) check (height_cm between 100 and 250);

-- Saves the details on a member and marks them onboarded at the gym. Internal:
-- called by save_admission_details() and claim_gym_invites() only.
create function public.apply_admission_details(
  p_gym_id uuid, p_user_id uuid, p_full_name text, p_phone text, p_date_of_birth date,
  p_weight_kg numeric, p_height_cm numeric
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set full_name = p_full_name
    where id = p_user_id and trim(coalesce(full_name, '')) = '';
  if p_phone is not null then
    insert into public.contact_details (user_id, phone, date_of_birth)
      values (p_user_id, p_phone, p_date_of_birth)
      on conflict (user_id) do update
        set date_of_birth = coalesce(public.contact_details.date_of_birth, excluded.date_of_birth),
            updated_at = now();
  end if;
  insert into public.body_measurements (gym_id, member_id, measured_on, weight_kg, height_cm)
    values (p_gym_id, p_user_id, public.gym_day(p_gym_id), p_weight_kg, p_height_cm)
    on conflict (gym_id, member_id, measured_on) do nothing;
  update public.gym_members set onboarded_at = coalesce(onboarded_at, now())
    where gym_id = p_gym_id and user_id = p_user_id and role = 'member';
end;
$$;

revoke execute on function public.apply_admission_details(uuid, uuid, text, text, date, numeric, numeric)
  from public, anon, authenticated;

-- Called by the app right after a member invite. A pending invite keeps the
-- details until they join; someone who already had an account and was just
-- added gets them now. Trainers only fill in details for members they invited.
create function public.save_admission_details(
  p_gym_id uuid, p_email text, p_full_name text, p_phone text, p_date_of_birth date,
  p_weight_kg numeric, p_height_cm numeric
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  -- Stored like the app stores mobiles: 10 digits for an Indian number.
  v_phone text := regexp_replace(
    regexp_replace(coalesce(p_phone, ''), '[\s()-]', '', 'g'), '^(\+91|0)([6-9][0-9]{9})$', '\2'
  );
  v_manager boolean := public.can_manage_gym(p_gym_id) or public.is_platform_admin();
  v_user_id uuid;
begin
  if not v_manager and not public.has_gym_role(p_gym_id, array['trainer']) then
    raise exception 'Only owners, supervisors and trainers can admit members';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Enter their full name';
  end if;
  if v_phone !~ '^\+?[0-9]{7,15}$' then
    raise exception 'Enter a valid mobile number';
  end if;
  if p_date_of_birth is null then
    raise exception 'Enter their date of birth';
  end if;
  perform public.check_birth_date(p_date_of_birth);
  if p_weight_kg is null or p_weight_kg not between 20 and 300 then
    raise exception 'Enter their weight from 20 to 300 kg';
  end if;
  if p_height_cm is null or p_height_cm not between 100 and 250 then
    raise exception 'Enter their height from 100 to 250 cm';
  end if;

  update public.gym_invites
    set full_name = v_name, phone = v_phone, date_of_birth = p_date_of_birth,
        weight_kg = p_weight_kg, height_cm = p_height_cm
    where gym_id = p_gym_id and email = v_email and role = 'member'
      and (v_manager or invited_by = auth.uid());
  if found then
    return;
  end if;

  -- Already had an account, so invite_to_gym() added them straight away.
  select gm.user_id into v_user_id
    from public.gym_members gm
    join auth.users u on u.id = gm.user_id
    where gm.gym_id = p_gym_id and lower(u.email) = v_email and gm.role = 'member'
      and gm.status = 'active' and gm.onboarded_at is null
      and (v_manager or gm.admitted_by = auth.uid());
  if v_user_id is null then
    raise exception 'No new member invite for this email';
  end if;
  perform public.apply_admission_details(
    p_gym_id, v_user_id, v_name, v_phone, p_date_of_birth, p_weight_kg, p_height_cm
  );
end;
$$;

revoke execute on function public.save_admission_details(uuid, text, text, text, date, numeric, numeric)
  from public, anon;
grant execute on function public.save_admission_details(uuid, text, text, text, date, numeric, numeric)
  to authenticated;

-- Claiming an invite records the admission, maps a member a trainer invited to
-- that trainer, and now saves any admission details the inviter filled in.
create or replace function public.claim_gym_invites() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_invite record;
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
  for v_invite in
    select * from public.gym_invites
    where email = lower(new.email) and role = 'member' and full_name is not null
  loop
    perform public.apply_admission_details(
      v_invite.gym_id, new.id, v_invite.full_name, v_invite.phone, v_invite.date_of_birth,
      v_invite.weight_kg, v_invite.height_cm
    );
  end loop;
  delete from public.gym_invites where email = lower(new.email);
  return new;
end;
$$;

-- The join screen fills in the name the inviter gave.
drop function public.invite_by_code(text);

create function public.invite_by_code(p_code text)
returns table (gym_name text, email text, role text, full_name text)
language sql stable security definer set search_path = '' as $$
  select g.name, i.email, i.role, i.full_name
  from public.gym_invites i
  join public.gyms g on g.id = i.gym_id
  where i.code = public.normalize_invite_code(p_code)
    and i.code_expires_at > now()
    and not exists (
      select 1 from auth.users u
      where lower(u.email) = i.email and u.email_confirmed_at is not null
    )
$$;

revoke execute on function public.invite_by_code(text) from public;
grant execute on function public.invite_by_code(text) to anon, authenticated;
