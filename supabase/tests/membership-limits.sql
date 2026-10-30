-- Members need a current membership to check in, train and book; owners and supervisors
-- can make a member a trainer. Self-contained: run after the migrations. Each step says what
-- to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, raw_user_meta_data, email_confirmed_at) values
 ('ab000000-0000-0000-0000-00000000000a','{"full_name":"Olga Owner"}',now()),
 ('ab000000-0000-0000-0000-00000000000b','{"full_name":"Pia Paid"}',now()),
 ('ab000000-0000-0000-0000-00000000000c','{"full_name":"Nina Nopay"}',now()),
 ('ab000000-0000-0000-0000-00000000000d','{"full_name":"Sunil Supervisor"}',now()),
 ('ab000000-0000-0000-0000-00000000000e','{"full_name":"Tom Trainer"}',now()),
 ('ab000000-0000-0000-0000-00000000000f','{"full_name":"Ezhil Expired"}',now());
insert into public.brands (id, name) values ('ab300000-0000-0000-0000-000000000001','Limit Gym');
insert into public.gyms (id, name, brand_id) values
 ('ab100000-0000-0000-0000-000000000001','Limit Gym','ab300000-0000-0000-0000-000000000001');
insert into public.gym_members (gym_id, user_id, role) values
 ('ab100000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-00000000000a','owner'),
 ('ab100000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-00000000000b','member'),
 ('ab100000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-00000000000c','member'),
 ('ab100000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-00000000000d','supervisor'),
 ('ab100000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-00000000000e','trainer'),
 ('ab100000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-00000000000f','member');
insert into public.membership_plans (id, gym_id, name, price_cents, duration_days) values
 ('ab200000-0000-0000-0000-000000000001','ab100000-0000-0000-0000-000000000001','Monthly',150000,30);
-- Pia's runs to the end of the month; Ezhil's ended yesterday; Nina never paid.
insert into public.memberships (member_id, plan_id, starts_on, ends_on) values
 ('ab000000-0000-0000-0000-00000000000b','ab200000-0000-0000-0000-000000000001',current_date - 5, current_date + 24),
 ('ab000000-0000-0000-0000-00000000000f','ab200000-0000-0000-0000-000000000001',current_date - 30, current_date - 1);
insert into public.classes (id, gym_id, trainer_id, title, starts_at, duration_minutes, capacity) values
 ('ab400000-0000-0000-0000-000000000001','ab100000-0000-0000-0000-000000000001',
  'ab000000-0000-0000-0000-00000000000e','Spin',now() + interval '1 day',45,10);
insert into public.member_trainers (gym_id, member_id, trainer_id) values
 ('ab100000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-00000000000b','ab000000-0000-0000-0000-00000000000e');
insert into public.workouts (id, gym_id, trainer_id, title, duration_minutes) values
 ('ab500000-0000-0000-0000-000000000001','ab100000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-00000000000e','Tom push',45);
insert into public.workout_assignments (workout_id, member_id) values
 ('ab500000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-00000000000b');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'M1 Nina (no membership) can''t check in (expect No active membership. Renew to continue.)'
select pg_temp.as_user('ab000000-0000-0000-0000-00000000000c');
select public.check_in('ab100000-0000-0000-0000-000000000001');

\echo 'M2 Nor start a workout, book a class or a trainer (expect No active membership x3)'
select public.start_workout_attendance('ab100000-0000-0000-0000-000000000001', gen_random_uuid(), 'Legs');
select public.book_class('ab400000-0000-0000-0000-000000000001');
select public.book_trainer_session('ab100000-0000-0000-0000-000000000001',
  'ab000000-0000-0000-0000-00000000000e', now() + interval '1 day');

\echo 'M3 Ezhil''s ended yesterday, so he''s blocked too (expect No active membership)'
select pg_temp.as_user('ab000000-0000-0000-0000-00000000000f');
select public.check_in('ab100000-0000-0000-0000-000000000001');

\echo 'M4 Pia (paid) checks in, starts a workout and books Spin (expect member, empty, t)'
select pg_temp.as_user('ab000000-0000-0000-0000-00000000000b');
select role from public.check_in('ab100000-0000-0000-0000-000000000001');
select public.start_workout_attendance('ab100000-0000-0000-0000-000000000001', gen_random_uuid(), 'Push');
select public.book_class('ab400000-0000-0000-0000-000000000001') is not null as booked;

\echo 'M5 Pia gets past the membership check for a trainer (expect Trainer not found)'
select public.book_trainer_session('ab100000-0000-0000-0000-000000000001',
  'ab000000-0000-0000-0000-00000000000e', now() + interval '1 day');

\echo 'M6 Staff need no membership: Tom checks in (expect trainer)'
select pg_temp.as_user('ab000000-0000-0000-0000-00000000000e');
select role from public.check_in('ab100000-0000-0000-0000-000000000001');

\echo 'P1 A trainer can''t make trainers (expect Only owners and supervisors make trainers)'
select public.promote_to_trainer('ab100000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-00000000000c');

\echo 'P2 Nobody edits a role directly, even member to trainer (expect A role can''t be changed once it''s given)'
select pg_temp.as_user('ab000000-0000-0000-0000-00000000000a');
update public.gym_members set role = 'trainer'
where gym_id = 'ab100000-0000-0000-0000-000000000001' and user_id = 'ab000000-0000-0000-0000-00000000000c';

\echo 'P3 Only members can be made trainers (expect Only members can be made trainers)'
select public.promote_to_trainer('ab100000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-00000000000e');

\echo 'P4 The supervisor makes Pia a trainer (expect empty)'
select pg_temp.as_user('ab000000-0000-0000-0000-00000000000d');
select public.promote_to_trainer('ab100000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-00000000000b');

reset role;
\echo 'P5 Pia is a trainer, unmapped, with no plans, and was told (expect trainer, 0, 0, 1)'
select (select role from public.gym_members where gym_id = 'ab100000-0000-0000-0000-000000000001'
          and user_id = 'ab000000-0000-0000-0000-00000000000b') as role,
       (select count(*) from public.member_trainers where member_id = 'ab000000-0000-0000-0000-00000000000b') as links,
       (select count(*) from public.workout_assignments where member_id = 'ab000000-0000-0000-0000-00000000000b') as plans,
       (select count(*) from public.notifications where recipient_id = 'ab000000-0000-0000-0000-00000000000b'
          and title = 'You''re now a trainer') as told;

\echo 'P6 The lock is back after the promotion: no trainer to supervisor (expect A role can''t be changed once it''s given)'
set role authenticated;
select pg_temp.as_user('ab000000-0000-0000-0000-00000000000a');
update public.gym_members set role = 'supervisor'
where gym_id = 'ab100000-0000-0000-0000-000000000001' and user_id = 'ab000000-0000-0000-0000-00000000000b';

\echo 'P7 A suspended member has to be reactivated first (expect Reactivate them first)'
reset role;
update public.gym_members set status = 'suspended'
where gym_id = 'ab100000-0000-0000-0000-000000000001' and user_id = 'ab000000-0000-0000-0000-00000000000c';
set role authenticated;
select public.promote_to_trainer('ab100000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-00000000000c');
reset role;

\echo 'C1 CoreFit Gym takes no cut of online payments (expect 0)'
select online_cut_bps from public.platform_settings;
