-- Weekday plans and catch-up days. Self-contained: run after the migrations.
-- Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, raw_user_meta_data, email_confirmed_at) values
 ('d7000000-0000-0000-0000-00000000000a','{"full_name":"Dee Owner"}',now()),
 ('d7000000-0000-0000-0000-00000000000b','{"full_name":"Tom Trainer"}',now()),
 ('d7000000-0000-0000-0000-00000000000c','{"full_name":"Mia Member"}',now()),
 ('d7000000-0000-0000-0000-00000000000f','{"full_name":"Sid Supervisor"}',now());
insert into public.brands (id, name) values ('d7300000-0000-0000-0000-000000000001','Days Gym');
insert into public.gyms (id, name, brand_id) values
 ('d7100000-0000-0000-0000-000000000001','Days Gym','d7300000-0000-0000-0000-000000000001');
insert into public.gym_members (gym_id, user_id, role) values
 ('d7100000-0000-0000-0000-000000000001','d7000000-0000-0000-0000-00000000000a','owner'),
 ('d7100000-0000-0000-0000-000000000001','d7000000-0000-0000-0000-00000000000b','trainer'),
 ('d7100000-0000-0000-0000-000000000001','d7000000-0000-0000-0000-00000000000c','member'),
 ('d7100000-0000-0000-0000-000000000001','d7000000-0000-0000-0000-00000000000f','supervisor');
insert into public.member_trainers (gym_id, member_id, trainer_id) values
 ('d7100000-0000-0000-0000-000000000001','d7000000-0000-0000-0000-00000000000c','d7000000-0000-0000-0000-00000000000b');
insert into public.workouts (id, gym_id, trainer_id, title, duration_minutes) values
 ('d7200000-0000-0000-0000-000000000001','d7100000-0000-0000-0000-000000000001','d7000000-0000-0000-0000-00000000000b','Tom push',45);
insert into public.workout_assignments (workout_id, member_id) values
 ('d7200000-0000-0000-0000-000000000001','d7000000-0000-0000-0000-00000000000c');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'D1 a new assignment has no days and the gym allows 1 catch-up day (expect {}, 1)'
select pg_temp.as_user('d7000000-0000-0000-0000-00000000000c');
select days from public.workout_assignments where member_id = 'd7000000-0000-0000-0000-00000000000c';
select workout_catch_up_days from public.gyms where id = 'd7100000-0000-0000-0000-000000000001';

\echo 'D2 the plan''s trainer sets Monday and Thursday (expect UPDATE 1, then {1,4})'
select pg_temp.as_user('d7000000-0000-0000-0000-00000000000b');
update public.workout_assignments set days = '{1,4}'
  where workout_id = 'd7200000-0000-0000-0000-000000000001' and member_id = 'd7000000-0000-0000-0000-00000000000c';
select days from public.workout_assignments where member_id = 'd7000000-0000-0000-0000-00000000000c';

\echo 'D3 a day outside 1 to 7 is refused (expect a check constraint error)'
update public.workout_assignments set days = '{8}'
  where workout_id = 'd7200000-0000-0000-0000-000000000001' and member_id = 'd7000000-0000-0000-0000-00000000000c';

\echo 'D4 the member cannot change their own days (expect UPDATE 0)'
select pg_temp.as_user('d7000000-0000-0000-0000-00000000000c');
update public.workout_assignments set days = '{2}'
  where workout_id = 'd7200000-0000-0000-0000-000000000001' and member_id = 'd7000000-0000-0000-0000-00000000000c';

\echo 'D5 members and trainers cannot change catch-up days (expect two errors)'
select public.set_workout_catch_up_days('d7100000-0000-0000-0000-000000000001', 2);
select pg_temp.as_user('d7000000-0000-0000-0000-00000000000b');
select public.set_workout_catch_up_days('d7100000-0000-0000-0000-000000000001', 2);

\echo 'D6 the supervisor sets 2, the owner can''t go past 3 (expect 2, then an error, still 2)'
select pg_temp.as_user('d7000000-0000-0000-0000-00000000000f');
select public.set_workout_catch_up_days('d7100000-0000-0000-0000-000000000001', 2);
select workout_catch_up_days from public.gyms where id = 'd7100000-0000-0000-0000-000000000001';
select pg_temp.as_user('d7000000-0000-0000-0000-00000000000a');
select public.set_workout_catch_up_days('d7100000-0000-0000-0000-000000000001', 4);
select workout_catch_up_days from public.gyms where id = 'd7100000-0000-0000-0000-000000000001';

reset role;
