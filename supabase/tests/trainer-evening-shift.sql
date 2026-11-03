-- Evening shifts: who sets them, who reads them, and the start time the month report hands the app.
-- Self-contained: run after the migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, raw_user_meta_data) values
 ('a7000000-0000-0000-0000-00000000000a','{"full_name":"Eva Owner"}'),
 ('a7000000-0000-0000-0000-00000000000b','{"full_name":"Ed Member"}'),
 ('a7000000-0000-0000-0000-00000000000c','{"full_name":"Ema Morning"}'),
 ('a7000000-0000-0000-0000-00000000000e','{"full_name":"Eli Evening"}'),
 ('a7000000-0000-0000-0000-00000000000d','{"full_name":"Esa Supervisor"}');
insert into public.brands (id, name) values ('a7300000-0000-0000-0000-000000000001','Eve Co');
insert into public.gyms (id, name, brand_id, time_zone, opens_at, closes_at) values
 ('a7100000-0000-0000-0000-000000000001','Eve Co','a7300000-0000-0000-0000-000000000001','Asia/Kolkata','05:00','22:00');
insert into public.gym_members (gym_id, user_id, role, joined_at) values
 ('a7100000-0000-0000-0000-000000000001','a7000000-0000-0000-0000-00000000000a','owner', now() - interval '90 days'),
 ('a7100000-0000-0000-0000-000000000001','a7000000-0000-0000-0000-00000000000b','member', now() - interval '90 days'),
 ('a7100000-0000-0000-0000-000000000001','a7000000-0000-0000-0000-00000000000c','trainer', now() - interval '90 days'),
 ('a7100000-0000-0000-0000-000000000001','a7000000-0000-0000-0000-00000000000e','trainer', now() - interval '90 days'),
 ('a7100000-0000-0000-0000-000000000001','a7000000-0000-0000-0000-00000000000d','supervisor', now() - interval '90 days');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'E1 The evening start needs working hours first (expect Set working hours first)'
select pg_temp.as_user('a7000000-0000-0000-0000-00000000000a');
select public.set_evening_shift_start('a7100000-0000-0000-0000-000000000001', '16:00');

\echo 'E2 Supervisors can''t set the start or a shift (expect Only owners set working hours, twice)'
select public.set_trainer_hour_rules('a7100000-0000-0000-0000-000000000001', 480, 120, 240, '{0}');
select pg_temp.as_user('a7000000-0000-0000-0000-00000000000d');
select public.set_evening_shift_start('a7100000-0000-0000-0000-000000000001', '16:00');
select public.set_trainer_shift('a7100000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-00000000000e', 'evening');

\echo 'E3 Only trainers get a shift, and only real shifts (expect Pick a trainer..., violates check constraint)'
select pg_temp.as_user('a7000000-0000-0000-0000-00000000000a');
select public.set_trainer_shift('a7100000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-00000000000b', 'evening');
select public.set_trainer_shift('a7100000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-00000000000e', 'night');

\echo 'E4 The owner sets 4 pm and puts Eli on evenings (expect 16:00:00; Eli evening)'
select public.set_evening_shift_start('a7100000-0000-0000-0000-000000000001', '16:00');
select public.set_trainer_shift('a7100000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-00000000000e', 'evening');
select evening_starts_at from public.trainer_hour_rules;
select p.full_name, s.shift from public.trainer_shifts s join public.profiles p on p.id = s.trainer_id;

\echo 'E5 Trainers and supervisors can''t read shifts (expect 0, 0)'
select pg_temp.as_user('a7000000-0000-0000-0000-00000000000e');
select count(*) from public.trainer_shifts;
select pg_temp.as_user('a7000000-0000-0000-0000-00000000000d');
select count(*) from public.trainer_shifts;

\echo 'E6 Ema starts at opening, Eli at 4 pm (expect Eli Evening 960, Ema Morning 300)'
reset role;
update public.trainer_hour_rules set starts_on = '2026-10-01';
set role authenticated;
select pg_temp.as_user('a7000000-0000-0000-0000-00000000000a');
select distinct full_name, start_minute, opens_minute
from public.trainer_hours_month('a7100000-0000-0000-0000-000000000001', '2026-10-15') order by full_name;

\echo 'E7 No evening start: everyone from opening (expect 300, 300)'
select public.set_evening_shift_start('a7100000-0000-0000-0000-000000000001', null);
select distinct full_name, start_minute
from public.trainer_hours_month('a7100000-0000-0000-0000-000000000001', '2026-10-15') order by full_name;
reset role;
