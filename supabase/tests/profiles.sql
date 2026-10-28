-- Profiles for every role: saving name, mobile and photo, and the avatar storage
-- rules. Self-contained: run after the migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('e0000000-0000-0000-0000-00000000000a','oscar@pf.test',now(),'{"full_name":"Oscar Owner"}'),
 ('e0000000-0000-0000-0000-00000000000b','tina@pf.test',now(),'{"full_name":"Tina Trainer"}');
insert into public.brands (id, name) values ('e3000000-0000-0000-0000-000000000001','PF Gym');
insert into public.gyms (id, name, brand_id) values
 ('e1000000-0000-0000-0000-000000000001','PF Gym','e3000000-0000-0000-0000-000000000001');
insert into public.gym_members (gym_id, user_id, role) values
 ('e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000a','owner'),
 ('e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000b','trainer');

\echo 'P1 The avatars bucket is public (expect t)'
select public from storage.buckets where id = 'avatars';

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'P2 A trainer needs a mobile (expect Enter a valid mobile number)'
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000b');
select public.save_my_profile('Tina Trainer', '', null);

\echo 'P3 A trainer can''t use someone else''s photo (expect That photo isn''t yours)'
select public.save_my_profile('Tina Trainer', '98765 43210', 'e0000000-0000-0000-0000-00000000000a/x.jpg');

\echo 'P4 A trainer saves their profile with a photo (expect ok)'
select public.save_my_profile('Tina T', '98765 43210', 'e0000000-0000-0000-0000-00000000000b/a.jpg');

\echo 'P5 Saved (expect Tina T | e0...0b/a.jpg | 9876543210)'
select p.full_name, p.avatar_path, cd.phone from public.profiles p
  join public.contact_details cd on cd.user_id = p.id
  where p.id = 'e0000000-0000-0000-0000-00000000000b';

\echo 'P6 Removing the photo keeps the mobile (expect null avatar, 9876543210)'
select public.save_my_profile('Tina T', '9876543210', null);
select avatar_path is null as no_avatar, cd.phone from public.profiles p
  join public.contact_details cd on cd.user_id = p.id
  where p.id = 'e0000000-0000-0000-0000-00000000000b';

\echo 'P7 Pointing your profile at another folder directly fails (expect violates check constraint profiles_avatar_in_own_folder)'
update public.profiles set avatar_path = 'e0000000-0000-0000-0000-00000000000a/x.jpg'
  where id = 'e0000000-0000-0000-0000-00000000000b';

\echo 'P8 Uploading to your own folder works (expect INSERT 0 1)'
insert into storage.objects (bucket_id, name) values ('avatars', 'e0000000-0000-0000-0000-00000000000b/b.jpg');

\echo 'P9 Uploading to someone else''s folder fails (expect row-level security violation)'
insert into storage.objects (bucket_id, name) values ('avatars', 'e0000000-0000-0000-0000-00000000000a/b.jpg');

\echo 'P10 The owner sees the trainer''s mobile and photo in People (expect Tina T | 9876543210 | null)'
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000a');
select full_name, phone, avatar_path from public.gym_people('e1000000-0000-0000-0000-000000000001')
  where role = 'trainer';

\echo 'P11 The owner can''t delete the trainer''s photo file (expect DELETE 0)'
delete from storage.objects where bucket_id = 'avatars' and name like 'e0000000-0000-0000-0000-00000000000b/%';

reset role;
