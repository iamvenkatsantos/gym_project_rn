-- A profile for every role.
--
-- Everyone (owner, supervisor, trainer and member) can add a profile photo,
-- and must have a mobile number. Members already give theirs on the
-- first-sign-in form (20261028020000_member_onboarding); owners, supervisors
-- and trainers without one are asked for it on their next sign-in, with their
-- name and an optional photo. Anyone can change these later from Profile.

-- Profile photos ----------------------------------------------------------------------

-- The photo's path in the avatars bucket. It always sits in the person's own
-- folder, so nobody can point their profile at someone else's photo.
alter table public.profiles
  add column avatar_path text,
  add constraint profiles_avatar_in_own_folder check (avatar_path like id::text || '/%');

-- Profile photos show next to names all over the app, for gym-mates as well as
-- staff, so the bucket is public: each file has a random name and can't be
-- listed. Progress photos stay in their private bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true, 2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- People only touch the files in their own <user id>/ folder. Deleting needs
-- select too, so they can see their own files (everyone else uses the public link).
create policy "Upload your own profile photo" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars' and public.storage_path_uuid(name, 1) = auth.uid()
  );
create policy "See your own profile photos" on storage.objects
  for select to authenticated using (
    bucket_id = 'avatars' and public.storage_path_uuid(name, 1) = auth.uid()
  );
create policy "Delete your own profile photo" on storage.objects
  for delete to authenticated using (
    bucket_id = 'avatars' and public.storage_path_uuid(name, 1) = auth.uid()
  );

-- Saving a profile --------------------------------------------------------------------

-- Name, mobile and photo in one go, from the first-sign-in screen for staff and
-- from Edit profile for anyone. A null photo removes it.
create function public.save_my_profile(p_full_name text, p_phone text, p_avatar_path text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := trim(coalesce(p_full_name, ''));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[\s()-]', '', 'g');
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Enter your full name';
  end if;
  if v_phone !~ '^\+?[0-9]{7,15}$' then
    raise exception 'Enter a valid mobile number';
  end if;
  if p_avatar_path is not null and p_avatar_path not like auth.uid()::text || '/%' then
    raise exception 'That photo isn''t yours';
  end if;

  update public.profiles set full_name = v_name, avatar_path = p_avatar_path
    where id = auth.uid();
  insert into public.contact_details (user_id, phone) values (auth.uid(), v_phone)
    on conflict (user_id) do update set phone = excluded.phone, updated_at = now();
end;
$$;

revoke execute on function public.save_my_profile(text, text, text) from public, anon;
grant execute on function public.save_my_profile(text, text, text) to authenticated;

-- People ------------------------------------------------------------------------------

-- The people list gains each person's photo.
drop function public.gym_people(uuid);

create function public.gym_people(p_gym_id uuid)
returns table (
  user_id uuid, full_name text, email text, role text, status text, joined_at timestamptz,
  phone text, admitted_by uuid, admitted_by_name text, admitted_at timestamptz,
  onboarded_at timestamptz, avatar_path text
)
language sql stable security definer set search_path = '' as $$
  select gm.user_id, p.full_name, u.email::text, gm.role, gm.status, gm.joined_at,
         cd.phone, gm.admitted_by, admitter.full_name, gm.admitted_at, gm.onboarded_at,
         p.avatar_path
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
