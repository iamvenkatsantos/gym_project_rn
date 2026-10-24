-- RLS and booking checks. Each step says what to expect; the "expect error" steps must print
-- that error. Run after the migrations on a scratch database, see README "Database checks".
\set ON_ERROR_STOP 0
insert into auth.users (id, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','{"full_name":"Olivia Owner"}'),
 ('00000000-0000-0000-0000-00000000000b','{"full_name":"Tom Trainer"}'),
 ('00000000-0000-0000-0000-00000000000c','{"full_name":"Maya Member"}'),
 ('00000000-0000-0000-0000-00000000000d','{"full_name":"Arjun Member"}'),
 ('00000000-0000-0000-0000-00000000000e','{"full_name":"Xavier Outsider"}');
insert into public.gyms (id, name) values ('10000000-0000-0000-0000-000000000001','CoreFit Anna Nagar'),('10000000-0000-0000-0000-000000000002','Other Gym');
insert into public.gym_members (gym_id, user_id, role) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','owner'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','trainer'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000b','member'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','member'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000d','member'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000e','member');
insert into public.trainer_profiles (gym_id, trainer_id, specialties) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','{strength}');
insert into public.trainer_availability (gym_id, trainer_id, weekday, start_time, end_time) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b',1,'09:00','12:00');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo '1 M books 10:00 IST (expect ok)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.book_trainer_session('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','2026-10-26 10:00+05:30') is not null as ok;
\echo '2 M2 books same slot (expect slot taken)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.book_trainer_session('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','2026-10-26 10:00+05:30');
\echo '3 M2 books overlapping 10:30 (expect slot taken)'
select public.book_trainer_session('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','2026-10-26 10:30+05:30');
\echo '4 M2 books 11:00 (expect ok)'
select public.book_trainer_session('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','2026-10-26 11:00+05:30') is not null as ok;
\echo '5 M2 books 11:30, runs past availability (expect not available)'
select public.book_trainer_session('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','2026-10-26 11:30+05:30');
\echo '6 Outsider books trainer in another gym (expect only members)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select public.book_trainer_session('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','2026-10-26 09:00+05:30');
\echo '7 visibility: M2 own=1, trainer=2, owner=2, outsider=0'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d'); select count(*) as m2 from public.trainer_sessions;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b'); select count(*) as trainer from public.trainer_sessions;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); select count(*) as owner from public.trainer_sessions;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e'); select count(*) as outsider from public.trainer_sessions;
\echo '8 busy slots as M2 (expect 2), as outsider (expect 0)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select count(*) from public.trainer_busy_slots('00000000-0000-0000-0000-00000000000b','2026-10-26','2026-10-27');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select count(*) from public.trainer_busy_slots('00000000-0000-0000-0000-00000000000b','2026-10-26','2026-10-27');
\echo '9 M2 tries to cancel M session (expect UPDATE 0)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
update public.trainer_sessions set status='cancelled' where starts_at='2026-10-26 10:00+05:30';
\echo '10 M cancels own (expect UPDATE 1), then M2 books freed slot (expect ok)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
update public.trainer_sessions set status='cancelled' where starts_at='2026-10-26 10:00+05:30';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.book_trainer_session('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','2026-10-26 10:00+05:30') is not null as ok;
\echo '11 gyms visible to outsider (expect Other Gym only), to trainer (expect both)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e'); select name from public.gyms order by name;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b'); select count(*) from public.gyms;
\echo '12 member promotes self to owner (expect RLS error / 0 rows)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
update public.gym_members set role='owner' where user_id='00000000-0000-0000-0000-00000000000c';
insert into public.gym_members (gym_id,user_id,role) values ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000c','owner');
\echo '13 trainer (member-only in gym 2) cannot create workouts there (expect RLS error)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.workouts (gym_id, trainer_id, title, duration_minutes) values ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000b','x',30);
\echo '14 trainer creates workout in gym 1 (expect INSERT ok)'
insert into public.workouts (gym_id, trainer_id, title, duration_minutes) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','x',30);
\echo '15 class booking still works for member (expect ok), outsider sees no classes'
reset role;
insert into public.classes (id, gym_id, trainer_id, title, starts_at, duration_minutes, capacity) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','HIIT',now()+interval '1 day',30,1);
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.book_class('20000000-0000-0000-0000-000000000001') is not null as ok;
select title, booked_count from public.class_schedule;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.book_class('20000000-0000-0000-0000-000000000001');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e'); select count(*) as outsider_classes from public.class_schedule;
\echo '16 profiles visible to outsider: self + gym-mates in gym 2 (expect 2: Xavier, Tom)'
select full_name from public.profiles order by full_name;

-- Fitness core ----------------------------------------------------------------
reset role;
insert into public.exercises (id, gym_id, name, muscle_groups, equipment) values
 ('30000000-0000-0000-0000-000000000001', null, 'Goblet squat', '{legs}', 'dumbbell'),
 ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'House sled push', '{legs}', 'sled');
insert into public.workouts (id, gym_id, trainer_id, title, duration_minutes) values
 ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','Leg day',45);
set role authenticated;

\echo '17 exercises: outsider sees shared only (expect 1), member sees both (expect 2)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e'); select count(*) from public.exercises;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c'); select count(*) from public.exercises;
\echo '18 member logs a workout (expect ok), retry with same client_id is a no-op (expect 0 rows)'
insert into public.workout_logs (client_id, gym_id, member_id, workout_id, title, started_at, completed_at)
  values ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','40000000-0000-0000-0000-000000000001','Leg day', now() - interval '1 hour', now())
  returning true as ok;
insert into public.workout_logs (client_id, gym_id, member_id, title, started_at, completed_at)
  values ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','Leg day', now() - interval '1 hour', now())
  on conflict (client_id) do nothing returning true as inserted_again;
insert into public.workout_log_sets (log_id, exercise_id, set_number, reps, weight_kg)
  select id, '30000000-0000-0000-0000-000000000001', 1, 10, 20 from public.workout_logs where client_id = '50000000-0000-0000-0000-000000000001'
  returning true as set_ok;
\echo '19 member logs as someone else (expect RLS error)'
insert into public.workout_logs (client_id, gym_id, member_id, title, started_at, completed_at)
  values (gen_random_uuid(),'10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000d','x', now(), now());
\echo '20 other member and unassigned trainer see no logs (expect 0, 0)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d'); select count(*) from public.workout_logs;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b'); select count(*) from public.workout_logs;
\echo '21 trainer assigns plan to member, then sees log and sets (expect 1, 1)'
insert into public.workout_assignments (workout_id, member_id, assigned_by)
  values ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-00000000000b');
select count(*) from public.workout_logs;
select count(*) from public.workout_log_sets;
\echo '22 trainer cannot assign a plan to someone outside the gym (expect RLS error)'
insert into public.workout_assignments (workout_id, member_id)
  values ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000e');
\echo '23 body measurements stay private (member 1, trainer 0)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into public.body_measurements (member_id, metric, value) values ('00000000-0000-0000-0000-00000000000c','weight_kg',62.5);
select count(*) from public.body_measurements;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b'); select count(*) from public.body_measurements;
\echo '24 member cannot edit plan exercises (expect RLS error), trainer can (expect ok)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into public.workout_exercises (workout_id, exercise_id, position, sets, reps) values ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',1,3,10);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.workout_exercises (workout_id, exercise_id, position, sets, reps) values ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',1,3,10) returning true as ok;
