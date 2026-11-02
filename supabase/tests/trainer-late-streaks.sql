-- Late check-in streaks: the owner's late rule and the times the month report hands the app.
-- Self-contained: run after the migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, raw_user_meta_data) values
 ('b0000000-0000-0000-0000-00000000000a','{"full_name":"Lata Owner"}'),
 ('b0000000-0000-0000-0000-00000000000c','{"full_name":"Lal Trainer"}'),
 ('b0000000-0000-0000-0000-00000000000d','{"full_name":"Lee Supervisor"}');
insert into public.brands (id, name) values ('b3000000-0000-0000-0000-000000000001','Late Co');
insert into public.gyms (id, name, brand_id, time_zone, opens_at, closes_at) values
 ('b1000000-0000-0000-0000-000000000001','Late Co','b3000000-0000-0000-0000-000000000001','Asia/Kolkata','05:00','22:00');
insert into public.gym_members (gym_id, user_id, role, joined_at) values
 ('b1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-00000000000a','owner', now() - interval '90 days'),
 ('b1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-00000000000c','trainer', now() - interval '90 days'),
 ('b1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-00000000000d','supervisor', now() - interval '90 days');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;

-- In at 06:10 on the 20th, 05:05 on the 21st; approved permission from 05:00 on the 22nd.
insert into public.attendance (gym_id, user_id, day, role, checked_in_at, checked_out_at) values
 ('b1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-00000000000c','2026-10-20','trainer',
  '2026-10-20 06:10+05:30','2026-10-20 14:10+05:30'),
 ('b1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-00000000000c','2026-10-21','trainer',
  '2026-10-21 05:05+05:30','2026-10-21 13:05+05:30');
insert into public.work_permissions (gym_id, trainer_id, day, starts_at, ends_at, reason, status) values
 ('b1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-00000000000c','2026-10-22','05:00','07:00','medical','approved'),
 ('b1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-00000000000c','2026-10-22','12:00','13:00','travel','approved');

set role authenticated;

\echo 'L1 The late rule needs working hours first (expect Set working hours first)'
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000a');
select public.set_trainer_late_rule('b1000000-0000-0000-0000-000000000001', 15, 2, 240);

\echo 'L2 Supervisors and trainers can''t set it (expect Only owners set working hours, twice)'
select public.set_trainer_hour_rules('b1000000-0000-0000-0000-000000000001', 480, 120, 240, '{0}');
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000d');
select public.set_trainer_late_rule('b1000000-0000-0000-0000-000000000001', 15, 2, 240);
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000c');
select public.set_trainer_late_rule('b1000000-0000-0000-0000-000000000001', 15, 2, 240);

\echo 'L3 Out-of-range streaks are refused (expect violates check constraint)'
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000a');
select public.set_trainer_late_rule('b1000000-0000-0000-0000-000000000001', 15, 9, 240);

\echo 'L4 The owner saves 15 min, 2 days, 4 h (expect 15, 2, 240)'
select public.set_trainer_late_rule('b1000000-0000-0000-0000-000000000001', 15, 2, 240);
select late_after_minutes, late_streak_days, late_lop_minutes from public.trainer_hour_rules;

\echo 'L5 Switching it off keeps the rest (expect null, 2, 240)'
select public.set_trainer_late_rule('b1000000-0000-0000-0000-000000000001', null, 2, 240);
select late_after_minutes, late_streak_days, late_lop_minutes from public.trainer_hour_rules;

\echo 'L6 The month has first check-ins, permission starts and opening (expect 20th 370/null/300, 21st 305/null/300, 22nd null/300/300, 23rd null/null/300)'
reset role;
update public.trainer_hour_rules set starts_on = '2026-10-01';
set role authenticated;
select day, first_in_minute, permission_from_minute, opens_minute, permission_minutes
from public.trainer_hours_month('b1000000-0000-0000-0000-000000000001', '2026-10-15')
where day between '2026-10-20' and '2026-10-23' order by day;

\echo 'L7 Open 24 hours: no opening time (expect null)'
reset role;
update public.gyms set opens_at = null, closes_at = null where id = 'b1000000-0000-0000-0000-000000000001';
set role authenticated;
select distinct opens_minute from public.trainer_hours_month('b1000000-0000-0000-0000-000000000001', '2026-10-15');
reset role;
