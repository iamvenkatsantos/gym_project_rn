-- Trainer hours: worked minutes, the owner's secret rules, permissions and the LOP report.
-- Self-contained: run after the migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, raw_user_meta_data) values
 ('c0000000-0000-0000-0000-00000000000a','{"full_name":"Tara Owner"}'),
 ('c0000000-0000-0000-0000-00000000000b','{"full_name":"Tom Member"}'),
 ('c0000000-0000-0000-0000-00000000000c','{"full_name":"Tina Trainer"}'),
 ('c0000000-0000-0000-0000-00000000000d','{"full_name":"Tej Supervisor"}');
insert into public.brands (id, name) values ('c3000000-0000-0000-0000-000000000001','Hours Co');
insert into public.gyms (id, name, brand_id, time_zone) values
 ('c1000000-0000-0000-0000-000000000001','Hours Co','c3000000-0000-0000-0000-000000000001','Asia/Kolkata');
insert into public.gym_members (gym_id, user_id, role, joined_at) values
 ('c1000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-00000000000a','owner', now() - interval '90 days'),
 ('c1000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-00000000000b','member', now() - interval '90 days'),
 ('c1000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-00000000000c','trainer', now() - interval '90 days'),
 ('c1000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-00000000000d','supervisor', now() - interval '90 days');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;

\echo 'T1 Two visits add up: 06:00-10:00 and 17:00-21:00 (expect 480 worked, 240 longest)'
insert into public.attendance (gym_id, user_id, day, role, checked_in_at, last_check_in_at) values
 ('c1000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-00000000000c','2026-10-20','trainer',
  '2026-10-20 06:00+05:30','2026-10-20 06:00+05:30');
update public.attendance set checked_out_at = '2026-10-20 10:00+05:30'
 where user_id = 'c0000000-0000-0000-0000-00000000000c' and day = '2026-10-20';
update public.attendance set checked_out_at = null, last_check_in_at = '2026-10-20 17:00+05:30'
 where user_id = 'c0000000-0000-0000-0000-00000000000c' and day = '2026-10-20';
update public.attendance set checked_out_at = '2026-10-20 21:00+05:30'
 where user_id = 'c0000000-0000-0000-0000-00000000000c' and day = '2026-10-20';
select worked_minutes, longest_visit_minutes from public.attendance
 where user_id = 'c0000000-0000-0000-0000-00000000000c' and day = '2026-10-20';

set role authenticated;

\echo 'T2 Supervisors and trainers can''t set rules (expect Only owners set working hours, twice)'
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000d');
select public.set_trainer_hour_rules('c1000000-0000-0000-0000-000000000001', 480, 120, 240, '{0}');
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select public.set_trainer_hour_rules('c1000000-0000-0000-0000-000000000001', 480, 120, 240, '{0}');

\echo 'T3 Shortfall as big as the hours is refused (expect The allowed shortfall must be less...)'
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000a');
select public.set_trainer_hour_rules('c1000000-0000-0000-0000-000000000001', 480, 480, 240, '{0}');

\echo 'T4 The owner saves 8 h, 2 h, 4 h LOP, Sunday off (expect 480, 120, 240, {0})'
select public.set_trainer_hour_rules('c1000000-0000-0000-0000-000000000001', 480, 120, 240, '{0}');
select required_minutes, short_limit_minutes, lop_minutes, off_days from public.trainer_hour_rules;

\echo 'T5 Trainers and supervisors can''t read the rules (expect 0, 0)'
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select count(*) from public.trainer_hour_rules;
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000d');
select count(*) from public.trainer_hour_rules;

\echo 'T6 Members and supervisors can''t ask for permission (expect Only trainers ask..., twice)'
select public.request_permission('c1000000-0000-0000-0000-000000000001', current_date, '10:00', '12:00', 'medical', null);
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000b');
select public.request_permission('c1000000-0000-0000-0000-000000000001', current_date, '10:00', '12:00', 'medical', null);

\echo 'T7 Bad times and reasons are refused (expect The end time..., violates check constraint)'
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select public.request_permission('c1000000-0000-0000-0000-000000000001', current_date, '12:00', '10:00', 'medical', null);
select public.request_permission('c1000000-0000-0000-0000-000000000001', current_date, '10:00', '12:00', 'party', null);

\echo 'T8 The trainer asks for 2 h yesterday; the owner gets a push (expect 1 pending, 1 notification)'
select public.request_permission('c1000000-0000-0000-0000-000000000001', public.gym_day('c1000000-0000-0000-0000-000000000001') - 1,
  '10:00', '12:00', 'family', 'Wedding');
select count(*) from public.work_permissions where status = 'pending';
reset role;
select count(*) from public.notifications where recipient_id = 'c0000000-0000-0000-0000-00000000000a';
set role authenticated;

\echo 'T9 Supervisors see no requests and can''t answer them (expect 0, Only owners answer...)'
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000d');
select count(*) from public.work_permissions;
select public.decide_permission((select id from public.work_permissions limit 1), true);

\echo 'T10 The owner approves; the trainer is told (expect approved, 1)'
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000a');
select public.decide_permission((select id from public.work_permissions limit 1), true);
select status from public.work_permissions;
reset role;
select count(*) from public.notifications where recipient_id = 'c0000000-0000-0000-0000-00000000000c';
set role authenticated;

\echo 'T11 An answered request can''t be cancelled (expect Only a request still waiting...)'
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select public.cancel_permission((select id from public.work_permissions limit 1));

\echo 'T12 Only owners get the month (expect Only owners see trainer hours)'
select * from public.trainer_hours_month('c1000000-0000-0000-0000-000000000001', current_date);

\echo 'T13 Rules start today, so this month has no days yet (expect 0)'
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000a');
select count(*) from public.trainer_hours_month('c1000000-0000-0000-0000-000000000001', current_date);

\echo 'T14 Rules from 2026-10-01: October lists Tina only, no Sundays, with 120 permission minutes yesterday (expect only Tina Trainer; 0 Sundays; 480 on 10-20; 120 permission)'
reset role;
update public.trainer_hour_rules set starts_on = '2026-10-01' where gym_id = 'c1000000-0000-0000-0000-000000000001';
set role authenticated;
select distinct full_name from public.trainer_hours_month('c1000000-0000-0000-0000-000000000001', '2026-10-15');
select count(*) filter (where extract(dow from day) = 0) as sundays,
       max(worked_minutes) filter (where day = '2026-10-20') as on_20th
from public.trainer_hours_month('c1000000-0000-0000-0000-000000000001', '2026-10-15');
select permission_minutes from public.trainer_hours_month('c1000000-0000-0000-0000-000000000001', current_date)
 where day = public.gym_day('c1000000-0000-0000-0000-000000000001') - 1;
reset role;
