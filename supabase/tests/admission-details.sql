-- Admission details from the inviter: saved on the invite, applied when the
-- member joins (or straight away for someone with an account), and the member
-- skips the first-sign-in form. Self-contained: run after the migrations.
-- Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('fb000000-0000-0000-0000-00000000000a','owner@ad.test',now(),'{"full_name":"Ada Owner"}'),
 ('fb000000-0000-0000-0000-00000000000c','coach@ad.test',now(),'{"full_name":"Cara Coach"}'),
 ('fb000000-0000-0000-0000-00000000000d','coach2@ad.test',now(),'{"full_name":"Dev Coach"}'),
 ('fb000000-0000-0000-0000-00000000000e','has.account@ad.test',now(),'{"full_name":"Esha Existing"}'),
 ('fb000000-0000-0000-0000-00000000000f','plain@ad.test',now(),'{"full_name":"Pat Plain"}');
insert into public.brands (id, name) values ('fc000000-0000-0000-0000-000000000001','AD Gym');
insert into public.gyms (id, name, brand_id) values
 ('fd000000-0000-0000-0000-000000000001','AD Gym T Nagar','fc000000-0000-0000-0000-000000000001');
insert into public.gym_members (gym_id, user_id, role) values
 ('fd000000-0000-0000-0000-000000000001','fb000000-0000-0000-0000-00000000000a','owner'),
 ('fd000000-0000-0000-0000-000000000001','fb000000-0000-0000-0000-00000000000c','trainer'),
 ('fd000000-0000-0000-0000-000000000001','fb000000-0000-0000-0000-00000000000d','trainer');
update public.gyms set paid_until = current_date + 365 where paid_until is null;
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'A1 A trainer invites a new member on WhatsApp (expect invited)'
select pg_temp.as_user('fb000000-0000-0000-0000-00000000000c');
select result from public.whatsapp_invite('fd000000-0000-0000-0000-000000000001', 'neha@ad.test', 'member', '9840012345');

\echo 'A2 Missing details are refused (expect Enter their date of birth)'
select public.save_admission_details('fd000000-0000-0000-0000-000000000001', 'neha@ad.test', 'Neha New', '9840012345', null, 60, 160);

\echo 'A3 Another trainer can''t fill in her invite (expect No new member invite for this email)'
select pg_temp.as_user('fb000000-0000-0000-0000-00000000000d');
select public.save_admission_details('fd000000-0000-0000-0000-000000000001', 'neha@ad.test', 'Neha New', '9840012345', '1995-04-12', 60, 160);

\echo 'A4 Her trainer fills them in (expect a blank result)'
select pg_temp.as_user('fb000000-0000-0000-0000-00000000000c');
select public.save_admission_details('fd000000-0000-0000-0000-000000000001', 'neha@ad.test', '  Neha   New ', '+91 98400 12345', '1995-04-12', 60.5, 162);

\echo 'A5 The join screen gets her name (expect Neha New)'
select full_name from public.invite_by_code((select code from public.gym_invites where email = 'neha@ad.test'));
reset role;

\echo 'A6 Neha joins (no output)'
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('fb000000-0000-0000-0000-000000000011','neha@ad.test',now(),'{"full_name":""}');

\echo 'A7 Her details landed and she skips the form (expect Neha New, 9840012345, 1995-04-12, 60.50, 162.0, t, Cara Coach)'
select p.full_name, cd.phone, cd.date_of_birth, bm.weight_kg, bm.height_cm,
       gm.onboarded_at is not null as onboarded, t.full_name as trainer
from public.profiles p
join public.contact_details cd on cd.user_id = p.id
join public.body_measurements bm on bm.member_id = p.id
join public.gym_members gm on gm.user_id = p.id
join public.member_trainers mt on mt.member_id = p.id
join public.profiles t on t.id = mt.trainer_id
where p.id = 'fb000000-0000-0000-0000-000000000011';

\echo 'A8 The owner invites someone with an account and fills in details; she accepts (expect invited_in_app, a blank result, the gym id)'
set role authenticated;
select pg_temp.as_user('fb000000-0000-0000-0000-00000000000a');
select public.invite_to_gym('fd000000-0000-0000-0000-000000000001', 'has.account@ad.test', 'member');
select public.save_admission_details('fd000000-0000-0000-0000-000000000001', 'has.account@ad.test', 'Someone Else', '9876500000', '1990-01-01', 80, 175);
select pg_temp.as_user('fb000000-0000-0000-0000-00000000000e');
select public.accept_gym_invite((select id from public.my_gym_invites() limit 1), false);
select pg_temp.as_user('fb000000-0000-0000-0000-00000000000a');

\echo 'A9 Her own name stays, the rest is saved, she skips the form (expect Esha Existing, 9876500000, 1990-01-01, 80.00, t)'
select p.full_name, cd.phone, cd.date_of_birth, bm.weight_kg, gm.onboarded_at is not null
from public.profiles p
join public.contact_details cd on cd.user_id = p.id
join public.body_measurements bm on bm.member_id = p.id
join public.gym_members gm on gm.user_id = p.id
where p.id = 'fb000000-0000-0000-0000-00000000000e';

\echo 'A10 Not again once onboarded (expect No new member invite for this email)'
select public.save_admission_details('fd000000-0000-0000-0000-000000000001', 'has.account@ad.test', 'Esha E', '9876500000', '1990-01-01', 81, 175);

\echo 'A11 Without details the member still fills in the form (expect invited_in_app, the gym id, f)'
select public.invite_to_gym('fd000000-0000-0000-0000-000000000001', 'plain@ad.test', 'member');
select pg_temp.as_user('fb000000-0000-0000-0000-00000000000f');
select public.accept_gym_invite((select id from public.my_gym_invites() limit 1), false);
select onboarded_at is not null from public.gym_members where user_id = 'fb000000-0000-0000-0000-00000000000f';

\echo 'A12 Members can''t call it (expect Only owners, supervisors and trainers can admit members)'
select pg_temp.as_user('fb000000-0000-0000-0000-00000000000f');
select public.save_admission_details('fd000000-0000-0000-0000-000000000001', 'x@ad.test', 'X Y', '9840012345', '1995-04-12', 60, 160);

\echo 'A13 The internal function is closed (expect permission denied)'
select public.apply_admission_details('fd000000-0000-0000-0000-000000000001', 'fb000000-0000-0000-0000-00000000000f', 'X', '9840012345', null, 60, 160);
reset role;
