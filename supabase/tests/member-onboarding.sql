-- Member onboarding and admissions: trainer invites, who admitted whom, the
-- first-sign-in form and who can read phone numbers. Self-contained: run after
-- the migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('f0000000-0000-0000-0000-00000000000a','olivia@ob.test',now(),'{"full_name":"Olivia Owner"}'),
 ('f0000000-0000-0000-0000-00000000000b','manoj@ob.test',now(),'{"full_name":"Manoj Member"}'),
 ('f0000000-0000-0000-0000-00000000000c','tara@ob.test',now(),'{"full_name":"Tara Trainer"}'),
 ('f0000000-0000-0000-0000-00000000000d','sam@ob.test',now(),'{"full_name":"Sam Supervisor"}'),
 ('f0000000-0000-0000-0000-00000000000e','priya@ob.test',now(),'{"full_name":"Priya Existing"}'),
 ('f0000000-0000-0000-0000-000000000010','tom@ob.test',now(),'{"full_name":"Tom Trainer Elsewhere"}');
insert into public.brands (id, name) values ('f3000000-0000-0000-0000-000000000001','OB Gym');
insert into public.gyms (id, name, brand_id) values
 ('f1000000-0000-0000-0000-000000000001','OB Gym Velachery','f3000000-0000-0000-0000-000000000001'),
 ('f1000000-0000-0000-0000-000000000002','OB Gym Adyar','f3000000-0000-0000-0000-000000000001');
insert into public.gym_members (gym_id, user_id, role) values
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000a','owner'),
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000b','member'),
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000c','trainer'),
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000d','supervisor'),
 ('f1000000-0000-0000-0000-000000000002','f0000000-0000-0000-0000-000000000010','trainer');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'O1 A trainer can''t invite a trainer (expect Trainers can invite members only)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000c');
select public.invite_to_gym('f1000000-0000-0000-0000-000000000001', 'new.trainer@ob.test', 'trainer');

\echo 'O2 A trainer can''t invite to a branch they don''t work at (expect Only owners, supervisors and trainers can invite people)'
select public.invite_to_gym('f1000000-0000-0000-0000-000000000002', 'nila@ob.test', 'member');

\echo 'O3 A trainer invites a new member (expect invited)'
select public.invite_to_gym('f1000000-0000-0000-0000-000000000001', 'nila@ob.test', 'member');

\echo 'O4 The trainer sees their invite (expect nila@ob.test)'
select email from public.gym_invites where gym_id = 'f1000000-0000-0000-0000-000000000001';

\echo 'O5 A trainer can''t downgrade the supervisor''s trainer invite (expect This email already has an invite from your gym)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000d');
select public.invite_to_gym('f1000000-0000-0000-0000-000000000001', 'coach@ob.test', 'trainer');
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000c');
select public.invite_to_gym('f1000000-0000-0000-0000-000000000001', 'coach@ob.test', 'member');

\echo 'O6 The trainer doesn''t see the supervisor''s invite (expect nila@ob.test only)'
select email from public.gym_invites where gym_id = 'f1000000-0000-0000-0000-000000000001';

\echo 'O7 A trainer adds someone with an account straight away (expect added)'
select public.invite_to_gym('f1000000-0000-0000-0000-000000000001', 'priya@ob.test', 'member');
reset role;

\echo 'O8 Nila confirms her email and joins (no output)'
insert into auth.users (id, email, raw_user_meta_data) values
 ('f0000000-0000-0000-0000-000000000011','nila@ob.test','{"full_name":"Nila New"}');
update auth.users set email_confirmed_at = now() where id = 'f0000000-0000-0000-0000-000000000011';

\echo 'O9 Admissions and trainer mapping (expect Nila and Priya admitted by Tara Trainer and mapped to her, Manoj admitted by nobody, not onboarded)'
set role authenticated;
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000d');
select full_name, role, admitted_by_name, admitted_at is not null as has_date,
       onboarded_at is not null as onboarded
from public.gym_people('f1000000-0000-0000-0000-000000000001') order by full_name;
select p.full_name, t.full_name as trainer
from public.member_trainers mt
join public.profiles p on p.id = mt.member_id join public.profiles t on t.id = mt.trainer_id
where mt.gym_id = 'f1000000-0000-0000-0000-000000000001' order by 1;
reset role;

\echo 'O10 An owner can''t rewrite an admission (expect Tara Trainer)'
set role authenticated;
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000a');
update public.gym_members set admitted_by = 'f0000000-0000-0000-0000-00000000000a'
where user_id = 'f0000000-0000-0000-0000-000000000011';
select admitted_by_name from public.gym_people('f1000000-0000-0000-0000-000000000001')
where full_name = 'Nila New';

\echo 'O11 Staff can''t fill in the member form (expect Only members of this gym fill in this form)'
select public.complete_member_onboarding('f1000000-0000-0000-0000-000000000001', 'Olivia', '9876543210', 70, 170);

\echo 'O12 A bad phone is refused (expect Enter a valid phone number)'
select pg_temp.as_user('f0000000-0000-0000-0000-000000000011');
select public.complete_member_onboarding('f1000000-0000-0000-0000-000000000001', 'Nila N', '12ab', 60, 160);

\echo 'O13 Photos are required (expect Add your front, side, back photo)'
select public.complete_member_onboarding('f1000000-0000-0000-0000-000000000001', 'Nila N', '+91 98765 43210', 60, 160);

\echo 'O14 With two photos the last one is named (expect Add your back photo)'
insert into public.progress_photos (gym_id, member_id, storage_path, pose) values
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000011','f1000000-0000-0000-0000-000000000001/f0000000-0000-0000-0000-000000000011/1.jpg','front'),
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000011','f1000000-0000-0000-0000-000000000001/f0000000-0000-0000-0000-000000000011/2.jpg','side');
select public.complete_member_onboarding('f1000000-0000-0000-0000-000000000001', 'Nila N', '+91 98765 43210', 60, 160);

\echo 'O15 With all three it saves (expect a blank result)'
insert into public.progress_photos (gym_id, member_id, storage_path, pose) values
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000011','f1000000-0000-0000-0000-000000000001/f0000000-0000-0000-0000-000000000011/3.jpg','back');
select public.complete_member_onboarding('f1000000-0000-0000-0000-000000000001', 'Nila N', '+91 98765 43210', 60.5, 160);

\echo 'O16 Name, phone, first measurement and onboarded (expect Nila N, +919876543210, 60.50, 160.0, t)'
select p.full_name, cd.phone, bm.weight_kg, bm.height_cm, gm.onboarded_at is not null
from public.profiles p
join public.contact_details cd on cd.user_id = p.id
join public.body_measurements bm on bm.member_id = p.id
join public.gym_members gm on gm.user_id = p.id
where p.id = 'f0000000-0000-0000-0000-000000000011';

\echo 'O17 Members can''t write contact details directly (expect permission denied)'
insert into public.contact_details (user_id, phone) values ('f0000000-0000-0000-0000-000000000011', '9999999999');

\echo 'O18 Another member can''t read her phone (expect 0)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000b');
select count(*) from public.contact_details;

\echo 'O19 Her trainer and the supervisor can (expect 1, 1)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000c');
select count(*) from public.contact_details;
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000d');
select count(*) from public.contact_details;

\echo 'O20 A trainer at another branch can''t (expect 0)'
select pg_temp.as_user('f0000000-0000-0000-0000-000000000010');
select count(*) from public.contact_details;

\echo 'O21 The memberships export carries phone and admission (expect Nila N with +919876543210 admitted by Tara Trainer; Manoj with no admitter)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000a');
select member_name, phone, admitted_by, admitted_on is not null as has_date
from public.export_memberships('f1000000-0000-0000-0000-000000000001') order by member_name;

\echo 'O22 The trainer withdraws their own invite but not the supervisor''s (expect coach@ob.test left)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000c');
select public.invite_to_gym('f1000000-0000-0000-0000-000000000001', 'kavi@ob.test', 'member');
delete from public.gym_invites where email = 'coach@ob.test';
delete from public.gym_invites where email = 'kavi@ob.test';
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000a');
select email from public.gym_invites where gym_id = 'f1000000-0000-0000-0000-000000000001';
reset role;
