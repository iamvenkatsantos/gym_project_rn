-- WhatsApp invites without an email (mobile logins) and starting photos from
-- the inviter. Self-contained: run after the migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
insert into storage.buckets (id, name) values ('progress-photos', 'progress-photos')
  on conflict do nothing;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('fe000000-0000-0000-0000-00000000000a','owner@we.test',now(),'{"full_name":"Wes Owner"}'),
 ('fe000000-0000-0000-0000-00000000000c','coach@we.test',now(),'{"full_name":"Wren Coach"}'),
 ('fe000000-0000-0000-0000-00000000000b','member@we.test',now(),'{"full_name":"Will Member"}');
insert into public.brands (id, name) values ('fe100000-0000-0000-0000-000000000001','WE Gym');
insert into public.gyms (id, name, brand_id) values
 ('fe200000-0000-0000-0000-000000000001','WE Gym Porur','fe100000-0000-0000-0000-000000000001'),
 ('fe200000-0000-0000-0000-000000000002','WE Gym Other','fe100000-0000-0000-0000-000000000001');
insert into public.gym_members (gym_id, user_id, role, onboarded_at) values
 ('fe200000-0000-0000-0000-000000000001','fe000000-0000-0000-0000-00000000000a','owner',now()),
 ('fe200000-0000-0000-0000-000000000001','fe000000-0000-0000-0000-00000000000c','trainer',now()),
 ('fe200000-0000-0000-0000-000000000001','fe000000-0000-0000-0000-00000000000b','member',now());
update public.gyms set paid_until = current_date + 365 where paid_until is null;
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'W1 A WhatsApp invite without an email uses the mobile login (expect invited, t, 9840011111@m.vinven.net)'
select pg_temp.as_user('fe000000-0000-0000-0000-00000000000c');
select result, code is not null, email
from public.whatsapp_invite('fe200000-0000-0000-0000-000000000001', '', 'member', '+91 98400 11111');

\echo 'W2 Without an email the mobile must be Indian (expect Enter a 10-digit mobile number, or add an email)'
select * from public.whatsapp_invite('fe200000-0000-0000-0000-000000000001', null, 'member', '+4412345678');

\echo 'W3 With an email it works as before (expect invited, a@we.test)'
select result, email from public.whatsapp_invite('fe200000-0000-0000-0000-000000000001', 'A@we.test', 'member', '9840022222');

\echo 'W4 The trainer uploads admission photos to this gym (no output)'
insert into storage.objects (bucket_id, name) values
 ('progress-photos','fe200000-0000-0000-0000-000000000001/admissions/f1/front.jpg'),
 ('progress-photos','fe200000-0000-0000-0000-000000000001/admissions/f1/side.jpg'),
 ('progress-photos','fe200000-0000-0000-0000-000000000001/admissions/f1/back.jpg');

\echo 'W5 Members can''t upload there, nor anyone to another gym (expect two row-level security errors)'
select pg_temp.as_user('fe000000-0000-0000-0000-00000000000b');
insert into storage.objects (bucket_id, name) values
 ('progress-photos','fe200000-0000-0000-0000-000000000001/admissions/f2/front.jpg');
select pg_temp.as_user('fe000000-0000-0000-0000-00000000000c');
insert into storage.objects (bucket_id, name) values
 ('progress-photos','fe200000-0000-0000-0000-000000000002/admissions/f2/front.jpg');

\echo 'W6 Photos must be all three, in this gym''s folder (expect Add their back photo)'
select public.save_admission_details('fe200000-0000-0000-0000-000000000001', '9840011111@m.vinven.net', 'Mani Mobile', '9840011111', '1996-03-02', 70, 172,
  '{"front":"fe200000-0000-0000-0000-000000000001/admissions/f1/front.jpg","side":"fe200000-0000-0000-0000-000000000001/admissions/f1/side.jpg","back":"fe200000-0000-0000-0000-000000000001/admissions/missing.jpg"}');

\echo 'W7 Details and photos are saved on the invite (expect a blank result)'
select public.save_admission_details('fe200000-0000-0000-0000-000000000001', '9840011111@m.vinven.net', 'Mani Mobile', '9840011111', '1996-03-02', 70, 172,
  '{"front":"fe200000-0000-0000-0000-000000000001/admissions/f1/front.jpg","side":"fe200000-0000-0000-0000-000000000001/admissions/f1/side.jpg","back":"fe200000-0000-0000-0000-000000000001/admissions/f1/back.jpg"}');

\echo 'W8 Nobody reads the photos before they join (expect 0)'
select count(*) from storage.objects where name like '%/admissions/f1/%';
reset role;

\echo 'W9 Mani joins with the code (no output)'
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('fe000000-0000-0000-0000-000000000011','9840011111@m.vinven.net',now(),'{"full_name":"Mani M"}');

\echo 'W10 He skips the form and has three starting photos (expect t, back front side)'
select gm.onboarded_at is not null,
       (select string_agg(pose, ' ' order by pose) from public.progress_photos where member_id = gm.user_id)
from public.gym_members gm where gm.user_id = 'fe000000-0000-0000-0000-000000000011';

\echo 'W11 He, his trainer and the owner read the files; another member doesn''t (expect 3, 3, 3, 0)'
set role authenticated;
select pg_temp.as_user('fe000000-0000-0000-0000-000000000011');
select count(*) from storage.objects where name like '%/admissions/f1/%';
select pg_temp.as_user('fe000000-0000-0000-0000-00000000000c');
select count(*) from storage.objects where name like '%/admissions/f1/%';
select pg_temp.as_user('fe000000-0000-0000-0000-00000000000a');
select count(*) from storage.objects where name like '%/admissions/f1/%';
select pg_temp.as_user('fe000000-0000-0000-0000-00000000000b');
select count(*) from storage.objects where name like '%/admissions/f1/%';

\echo 'W12 Details without photos still work, as for older apps (expect a blank result)'
select pg_temp.as_user('fe000000-0000-0000-0000-00000000000a');
select public.save_admission_details('fe200000-0000-0000-0000-000000000001', 'a@we.test', 'Anu A', '9840022222', '1990-01-01', 60, 160);
reset role;
