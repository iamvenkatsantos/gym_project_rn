-- WhatsApp invites without an email, and starting photos from the inviter.
--
-- 1. A WhatsApp invite no longer needs an email. Without one, the account is
--    made with a login address built from the mobile number
--    (<10 digits>@m.vinven.net, a domain that receives no mail), and the person
--    signs in with their mobile number and password. The app turns a typed
--    mobile number into that address; nobody ever sees it.
--
-- 2. "Fill in now" on a member invite also takes the front, side and back
--    photos the member's first-sign-in form asks for. The inviter uploads them
--    to <gym_id>/admissions/<folder>/ in the progress-photos bucket (there's no
--    member id yet); when the member joins they become the member's first
--    progress photos, read by the same people as any other progress photo.

-- Mobile logins ------------------------------------------------------------------------

create function public.mobile_login_email(p_phone text) returns text
language sql immutable set search_path = '' as $$
  select p_phone || '@m.vinven.net'
$$;

-- Same as before, but an empty email means "sign in with the mobile number",
-- and the email used comes back so the app can show and reuse it.
drop function public.whatsapp_invite(uuid, text, text, text);

create function public.whatsapp_invite(p_gym_id uuid, p_email text, p_role text, p_phone text)
returns table (result text, code text, email text)
language plpgsql security definer set search_path = '' as $$
declare
  -- Stored like the app stores mobiles: 10 digits for an Indian number.
  v_phone text := regexp_replace(
    regexp_replace(coalesce(p_phone, ''), '[\s()-]', '', 'g'), '^(\+91|0)([6-9][0-9]{9})$', '\2'
  );
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_phone !~ '^\+?[0-9]{7,15}$' then
    raise exception 'Enter a valid mobile number';
  end if;
  if v_email = '' then
    if v_phone !~ '^[6-9][0-9]{9}$' then
      raise exception 'Enter a 10-digit mobile number, or add an email';
    end if;
    v_email := public.mobile_login_email(v_phone);
  end if;
  result := public.invite_to_gym(p_gym_id, v_email, p_role);
  code := null;
  email := v_email;
  if result = 'invited' then
    code := public.new_invite_code();
    update public.gym_invites i
      set code = whatsapp_invite.code, code_expires_at = now() + interval '7 days', phone = v_phone
      where i.gym_id = p_gym_id and i.email = v_email;
  end if;
  return next;
end;
$$;

revoke execute on function public.whatsapp_invite(uuid, text, text, text) from public, anon;
grant execute on function public.whatsapp_invite(uuid, text, text, text) to authenticated;

-- Starting photos from the inviter ---------------------------------------------------

alter table public.gym_invites
  add column photo_paths jsonb check (jsonb_typeof(photo_paths) = 'object');

-- A progress photo now lives either in the member's folder or in an admissions folder.
alter table public.progress_photos drop constraint progress_photos_check;
alter table public.progress_photos add constraint progress_photos_check check (
  storage_path like gym_id::text || '/' || member_id::text || '/%'
  or storage_path like gym_id::text || '/admissions/%'
);

-- Whoever can invite members at a gym uploads admission photos there.
create policy "Inviters upload admission photos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'progress-photos'
    and split_part(name, '/', 2) = 'admissions'
    and (
      public.can_manage_gym(public.storage_path_uuid(name, 1))
      or public.has_gym_role(public.storage_path_uuid(name, 1), array['trainer'])
    )
  );

-- Once they're a member's progress photos, the usual people read them.
create policy "Admission photos are read by role" on storage.objects
  for select to authenticated using (
    bucket_id = 'progress-photos'
    and split_part(name, '/', 2) = 'admissions'
    and exists (
      select 1 from public.progress_photos ph
      where ph.storage_path = objects.name
        and public.can_view_workout_logs(ph.gym_id, ph.member_id)
    )
  );

-- Deleting the photo record makes the file unreachable (reads need the record),
-- so there's no delete policy here; a leftover file is just storage.

-- Checks the inviter's photos: front, side and back, each uploaded to this
-- gym's admissions folder. Null (no photos) is fine; the member adds them later.
create function public.check_admission_photos(p_gym_id uuid, p_photos jsonb) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_pose text;
  v_path text;
begin
  if p_photos is null then
    return;
  end if;
  if jsonb_typeof(p_photos) <> 'object' then
    raise exception 'Add a front, side and back photo';
  end if;
  foreach v_pose in array array['front', 'side', 'back'] loop
    v_path := p_photos ->> v_pose;
    if v_path is null or v_path not like p_gym_id::text || '/admissions/%'
       or not exists (
         select 1 from storage.objects o where o.bucket_id = 'progress-photos' and o.name = v_path
       ) then
      raise exception 'Add their % photo', v_pose;
    end if;
  end loop;
end;
$$;

revoke execute on function public.check_admission_photos(uuid, jsonb) from public, anon, authenticated;

-- Saves the details (and photos, if any) on a member and marks them onboarded.
drop function public.apply_admission_details(uuid, uuid, text, text, date, numeric, numeric);

create function public.apply_admission_details(
  p_gym_id uuid, p_user_id uuid, p_full_name text, p_phone text, p_date_of_birth date,
  p_weight_kg numeric, p_height_cm numeric, p_photos jsonb default null
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
  if p_photos is not null then
    insert into public.progress_photos (gym_id, member_id, storage_path, pose, taken_on)
      select p_gym_id, p_user_id, photo.value, photo.key, public.gym_day(p_gym_id)
      from jsonb_each_text(p_photos) as photo
      where photo.key in ('front', 'side', 'back')
      on conflict (storage_path) do nothing;
  end if;
  update public.gym_members set onboarded_at = coalesce(onboarded_at, now())
    where gym_id = p_gym_id and user_id = p_user_id and role = 'member';
end;
$$;

revoke execute on function public.apply_admission_details(uuid, uuid, text, text, date, numeric, numeric, jsonb)
  from public, anon, authenticated;

-- The app's call after a member invite, now with the photos too. Without
-- p_photos it behaves as before, so older app versions keep working.
drop function public.save_admission_details(uuid, text, text, text, date, numeric, numeric);

create function public.save_admission_details(
  p_gym_id uuid, p_email text, p_full_name text, p_phone text, p_date_of_birth date,
  p_weight_kg numeric, p_height_cm numeric, p_photos jsonb default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
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
  perform public.check_admission_photos(p_gym_id, p_photos);

  update public.gym_invites
    set full_name = v_name, phone = v_phone, date_of_birth = p_date_of_birth,
        weight_kg = p_weight_kg, height_cm = p_height_cm, photo_paths = p_photos
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
    p_gym_id, v_user_id, v_name, v_phone, p_date_of_birth, p_weight_kg, p_height_cm, p_photos
  );
end;
$$;

revoke execute on function public.save_admission_details(uuid, text, text, text, date, numeric, numeric, jsonb)
  from public, anon;
grant execute on function public.save_admission_details(uuid, text, text, text, date, numeric, numeric, jsonb)
  to authenticated;

-- Claiming an invite now brings the inviter's photos along.
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
      v_invite.weight_kg, v_invite.height_cm, v_invite.photo_paths
    );
  end loop;
  delete from public.gym_invites where email = lower(new.email);
  return new;
end;
$$;
