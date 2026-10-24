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
reset role;
insert into public.member_trainers (gym_id, member_id, trainer_id)
  values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-00000000000b');
set role authenticated;
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

-- Trainer tools ---------------------------------------------------------------
reset role;
insert into public.exercises (id, gym_id, name, muscle_groups, equipment) values
 ('30000000-0000-0000-0000-000000000003', null, 'Push-up', '{chest}', 'none'),
 ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'Other gym secret', '{legs}', 'sled');
set role authenticated;

\echo '25 trainer creates a plan with save_workout (expect ok), exercises in the given order'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select set_config('test.plan', public.save_workout('10000000-0000-0000-0000-000000000001', null, ' Push day ', '', 'beginner', 40,
  '[{"exercise_id":"30000000-0000-0000-0000-000000000003","sets":3,"reps":12,"target_weight_kg":null,"rest_seconds":60},
    {"exercise_id":"30000000-0000-0000-0000-000000000001","sets":4,"reps":8,"target_weight_kg":16,"rest_seconds":90}]')::text, false) is not null as ok;
select w.title, x.name, we.position from public.workout_exercises we
  join public.workouts w on w.id = we.workout_id join public.exercises x on x.id = we.exercise_id
  where w.id = current_setting('test.plan')::uuid order by we.position;
\echo '26 trainer edits the plan, reordering and dropping an exercise (expect Goblet squat only, position 1)'
select public.save_workout('10000000-0000-0000-0000-000000000001', current_setting('test.plan')::uuid, 'Push day v2', '', 'intermediate', 45,
  '[{"exercise_id":"30000000-0000-0000-0000-000000000001","sets":4,"reps":8,"target_weight_kg":18,"rest_seconds":90}]') = current_setting('test.plan')::uuid as same_id;
select x.name, we.position, we.target_weight_kg from public.workout_exercises we join public.exercises x on x.id = we.exercise_id
  where we.workout_id = current_setting('test.plan')::uuid;
\echo '27 plan with another gym''s private exercise (expect RLS error), plan unchanged (expect 1)'
select public.save_workout('10000000-0000-0000-0000-000000000001', current_setting('test.plan')::uuid, 'Push day v3', '', 'beginner', 45,
  '[{"exercise_id":"30000000-0000-0000-0000-000000000004","sets":3,"reps":10,"target_weight_kg":null,"rest_seconds":90}]');
select count(*) from public.workout_exercises where workout_id = current_setting('test.plan')::uuid;
\echo '28 the same exercise twice in a plan (expect unique violation)'
select public.save_workout('10000000-0000-0000-0000-000000000001', current_setting('test.plan')::uuid, 'Push day', '', 'beginner', 45,
  '[{"exercise_id":"30000000-0000-0000-0000-000000000001","sets":3,"reps":10,"target_weight_kg":null,"rest_seconds":90},
    {"exercise_id":"30000000-0000-0000-0000-000000000001","sets":3,"reps":10,"target_weight_kg":null,"rest_seconds":90}]');
\echo '29 a plan with no exercises (expect "Add at least one exercise")'
select public.save_workout('10000000-0000-0000-0000-000000000001', null, 'Empty', '', 'beginner', 30, '[]');
\echo '30 a member saves a plan (expect RLS error) or edits the trainer''s plan (expect "Plan not found")'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.save_workout('10000000-0000-0000-0000-000000000001', null, 'Mine', '', 'beginner', 30,
  '[{"exercise_id":"30000000-0000-0000-0000-000000000001","sets":3,"reps":10,"target_weight_kg":null,"rest_seconds":90}]');
select public.save_workout('10000000-0000-0000-0000-000000000001', current_setting('test.plan')::uuid, 'Hijack', '', 'beginner', 30,
  '[{"exercise_id":"30000000-0000-0000-0000-000000000001","sets":3,"reps":10,"target_weight_kg":null,"rest_seconds":90}]');
\echo '31 trainer assigns without assigned_by; it defaults to the trainer (expect true). M2 sees it, M sees only own'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.member_trainers (gym_id, member_id, trainer_id)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000b');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.workout_assignments (workout_id, member_id) values (current_setting('test.plan')::uuid, '00000000-0000-0000-0000-00000000000d')
  returning assigned_by = '00000000-0000-0000-0000-00000000000b' as defaulted;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d'); select count(*) as m2_assignments from public.workout_assignments;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c'); select count(*) as m_assignments from public.workout_assignments;
\echo '32 trainer sets Tuesday hours and 45 min sessions (expect 2 windows), then M books Tue 17:45 IST (expect ok)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.set_trainer_availability('10000000-0000-0000-0000-000000000001', 45,
  '[{"weekday":2,"start_time":"07:00","end_time":"09:00"},{"weekday":2,"start_time":"17:00","end_time":"19:00"}]');
select count(*) as windows from public.trainer_availability;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.book_trainer_session('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','2026-10-27 17:45+05:30') is not null as ok;
\echo '33 Monday hours are gone now (expect not available)'
select public.book_trainer_session('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','2026-11-02 09:00+05:30');
\echo '34 overlapping windows (expect "overlap"), and the old hours are kept (expect 2)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.set_trainer_availability('10000000-0000-0000-0000-000000000001', 60,
  '[{"weekday":3,"start_time":"07:00","end_time":"10:00"},{"weekday":3,"start_time":"09:30","end_time":"11:00"}]');
select count(*) as windows from public.trainer_availability;
\echo '35 a member sets availability (expect "Only trainers"); trainer at gym 2 is only a member there (expect "Only trainers")'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.set_trainer_availability('10000000-0000-0000-0000-000000000001', 60, '[]');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.set_trainer_availability('10000000-0000-0000-0000-000000000002', 60, '[]');

-- Member management -------------------------------------------------------------
reset role;
update auth.users set email = 'xavier@example.com', email_confirmed_at = now()
  where id = '00000000-0000-0000-0000-00000000000e';
set role authenticated;

\echo '36 owner invites an existing account (expect added), again (expect already_member)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.invite_to_gym('10000000-0000-0000-0000-000000000001', ' Xavier@Example.com ', 'member');
select public.invite_to_gym('10000000-0000-0000-0000-000000000001', 'xavier@example.com', 'trainer');
\echo '37 owner invites a new email (expect invited), sees it pending (expect 1)'
select public.invite_to_gym('10000000-0000-0000-0000-000000000001', 'New.Trainer@example.com', 'trainer');
select email, role from public.gym_invites;
\echo '38 member or trainer invites (expect "Only owners" twice), bad email (expect "valid email")'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.invite_to_gym('10000000-0000-0000-0000-000000000001', 'friend@example.com', 'owner');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.invite_to_gym('10000000-0000-0000-0000-000000000001', 'friend@example.com', 'member');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.invite_to_gym('10000000-0000-0000-0000-000000000001', 'not-an-email', 'member');
\echo '39 members cannot see invites (expect 0)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c'); select count(*) from public.gym_invites;
\echo '40 sign-up claims the invite only once the email is confirmed (expect 0 then trainer)'
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000f', 'new.trainer@example.com', '{"full_name":"Nina New"}');
select count(*) as before_confirm from public.gym_members where user_id = '00000000-0000-0000-0000-00000000000f';
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-00000000000f';
select role as after_confirm from public.gym_members where user_id = '00000000-0000-0000-0000-00000000000f';
select count(*) as invites_left from public.gym_invites;
set role authenticated;
\echo '41 owner lists people with emails (expect 6 rows incl. Xavier and Nina); member gets none (expect 0)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select full_name, email, role from public.gym_people('10000000-0000-0000-0000-000000000001');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select count(*) from public.gym_people('10000000-0000-0000-0000-000000000001');
\echo '42 owner suspends Xavier (expect UPDATE 1); Xavier loses gym 1 (expect 1 gym visible: Other Gym)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.gym_members set status = 'suspended'
  where gym_id = '10000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-00000000000e';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e'); select name from public.gyms;
\echo '43 the only owner demotes or removes themselves (expect "at least one active owner" twice)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.gym_members set role = 'member'
  where gym_id = '10000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-00000000000a';
delete from public.gym_members
  where gym_id = '10000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-00000000000a';
\echo '44 with a second owner, the first can step down (expect UPDATE 1 twice)'
update public.gym_members set role = 'owner'
  where gym_id = '10000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-00000000000f';
update public.gym_members set role = 'trainer'
  where gym_id = '10000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-00000000000a';
\echo '45 a member cannot change roles (expect UPDATE 0)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
update public.gym_members set role = 'owner' where user_id = '00000000-0000-0000-0000-00000000000d';
\echo '46 deleting the last owner''s account still works (expect DELETE 1)'
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000000f';

-- Gym setup -------------------------------------------------------------------------
reset role;
update public.gym_members set role = 'owner', status = 'active'
  where gym_id = '10000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-00000000000a';
set role authenticated;

\echo '47 owner creates a plan (expect ok); member cannot (expect RLS error)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.membership_plans (id, gym_id, name, price_cents, duration_days)
  values ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Monthly', 149900, 30) returning true as ok;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into public.membership_plans (gym_id, name, price_cents, duration_days)
  values ('10000000-0000-0000-0000-000000000001', 'Free forever', 0, 3650);
\echo '48 owner records a paid membership for a member (expect ok, recorded_by = owner)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.memberships (member_id, plan_id, starts_on, ends_on, amount_paid_cents, payment_method)
  values ('00000000-0000-0000-0000-00000000000c', '60000000-0000-0000-0000-000000000001', current_date, current_date + 29, 149900, 'upi')
  returning recorded_by = '00000000-0000-0000-0000-00000000000a' as recorded_by_owner;
\echo '49 ... but not for someone outside the gym (expect RLS error)'
reset role;
insert into auth.users (id, raw_user_meta_data) values ('00000000-0000-0000-0000-000000000010', '{"full_name":"Gina Gym2"}');
insert into public.gym_members (gym_id, user_id, role) values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010', 'member');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.memberships (member_id, plan_id, starts_on, ends_on)
  values ('00000000-0000-0000-0000-000000000010', '60000000-0000-0000-0000-000000000001', current_date, current_date + 29);
\echo '50 owner schedules a class weekly for 4 weeks at 07:00 IST (expect 4, all at 07:00 local, one series)'
select public.schedule_classes('10000000-0000-0000-0000-000000000001', ' Morning HIIT ', '00000000-0000-0000-0000-00000000000b',
  (current_date + 1 + time '07:00') at time zone 'Asia/Kolkata', 45, 2, 4);
select count(*) as classes, count(distinct series_id) as series,
       bool_and(to_char(starts_at at time zone 'Asia/Kolkata', 'HH24:MI') = '07:00') as all_at_seven,
       bool_and(title = 'Morning HIIT') as trimmed
  from public.classes where title = 'Morning HIIT';
\echo '51 class with a trainer from another gym, or a member as trainer (expect "Pick a trainer" twice)'
select public.schedule_classes('10000000-0000-0000-0000-000000000001', 'Yoga', '00000000-0000-0000-0000-00000000000c',
  now() + interval '2 days', 60, 10, 1);
insert into public.classes (gym_id, trainer_id, title, starts_at, duration_minutes, capacity)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000e', 'Yoga', now() + interval '2 days', 60, 10);
\echo '52 trainer cannot schedule a class for nobody (expect RLS error); past time (expect "future"); 30 weeks (expect "1 to 26")'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.schedule_classes('10000000-0000-0000-0000-000000000001', 'Mine', null, now() + interval '1 day', 30, 5, 1);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.schedule_classes('10000000-0000-0000-0000-000000000001', 'Late', null, now() - interval '1 hour', 30, 5, 1);
select public.schedule_classes('10000000-0000-0000-0000-000000000001', 'Long', null, now() + interval '1 day', 30, 5, 30);
\echo '53 two members book week 2 (expect ok, ok); owner lowers capacity to 1 (expect "More people have booked")'
select set_config('test.week2', (select id::text from public.classes where title = 'Morning HIIT' order by starts_at offset 1 limit 1), false) is not null as ok;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.book_class(current_setting('test.week2')::uuid) is not null as ok;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.book_class(current_setting('test.week2')::uuid) is not null as ok;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.classes set capacity = 1 where id = current_setting('test.week2')::uuid;
\echo '54 owner cancels week 2 and the rest of the series (expect 3); bookings cancelled (expect 0 booked); schedule shows 1'
select public.cancel_class(current_setting('test.week2')::uuid, true);
select count(*) as still_booked from public.bookings
  where class_id = current_setting('test.week2')::uuid and status = 'booked';
select count(*) as on_schedule from public.class_schedule where title = 'Morning HIIT';
\echo '55 member cannot book a cancelled class (expect "Class not found") or cancel classes (expect "Class not found")'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.book_class(current_setting('test.week2')::uuid);
select public.cancel_class(current_setting('test.week2')::uuid, false);

-- Supervisors and trainer mapping ----------------------------------------------------
reset role;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000020', 'sam@example.com', now(), '{"full_name":"Sam Supervisor"}'),
  ('00000000-0000-0000-0000-000000000021', 'uma@example.com', now(), '{"full_name":"Uma New"}'),
  ('00000000-0000-0000-0000-000000000022', 'ravi@example.com', now(), '{"full_name":"Ravi Unmapped"}');
insert into public.gym_members (gym_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000020', 'supervisor'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021', 'member'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000022', 'member');
set role authenticated;

\echo '56 supervisor invites a member and a trainer (expect invited twice), not a supervisor or owner (expect "Only owners can invite supervisors" twice)'
select pg_temp.as_user('00000000-0000-0000-0000-000000000020');
select public.invite_to_gym('10000000-0000-0000-0000-000000000001', 'new.member@example.com', 'member');
select public.invite_to_gym('10000000-0000-0000-0000-000000000001', 'new.coach@example.com', 'trainer');
select public.invite_to_gym('10000000-0000-0000-0000-000000000001', 'boss@example.com', 'supervisor');
select public.invite_to_gym('10000000-0000-0000-0000-000000000001', 'boss@example.com', 'owner');
\echo '57 owner invites a supervisor (expect invited); supervisor cannot withdraw it (expect DELETE 0) but can withdraw a member invite (expect DELETE 1)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.invite_to_gym('10000000-0000-0000-0000-000000000001', 'second.sup@example.com', 'supervisor');
select pg_temp.as_user('00000000-0000-0000-0000-000000000020');
delete from public.gym_invites where email = 'second.sup@example.com';
delete from public.gym_invites where email = 'new.member@example.com';
\echo '58 supervisor lists people (expect > 0), cannot change roles or suspend (expect UPDATE 0 twice)'
select count(*) > 0 as sees_people from public.gym_people('10000000-0000-0000-0000-000000000001');
update public.gym_members set role = 'trainer' where user_id = '00000000-0000-0000-0000-00000000000c';
update public.gym_members set status = 'suspended' where user_id = '00000000-0000-0000-0000-00000000000c';
\echo '59 supervisor sees payments (expect > 0), records one (expect ok), cannot edit or delete one (expect UPDATE 0, DELETE 0)'
select count(*) > 0 as sees_payments from public.memberships;
insert into public.memberships (member_id, plan_id, starts_on, ends_on, amount_paid_cents, payment_method)
  values ('00000000-0000-0000-0000-00000000000d', '60000000-0000-0000-0000-000000000001', current_date, current_date + 30, 149900, 'upi')
  returning recorded_by = '00000000-0000-0000-0000-000000000020' as ok;
update public.memberships set amount_paid_cents = 0;
delete from public.memberships;
\echo '60 supervisor cannot edit plans (expect UPDATE 0) or schedule classes (expect RLS error)'
update public.membership_plans set price_cents = 1;
select public.schedule_classes('10000000-0000-0000-0000-000000000001', 'Sup class', '00000000-0000-0000-0000-00000000000b', now() + interval '1 day', 30, 5, 1);
\echo '61 supervisor maps Uma to the trainer (expect INSERT), a member as trainer (expect "Pick a trainer"), the trainer as member (expect "Pick an active member")'
insert into public.member_trainers (gym_id, member_id, trainer_id)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-00000000000b');
insert into public.member_trainers (gym_id, member_id, trainer_id)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-00000000000d');
insert into public.member_trainers (gym_id, member_id, trainer_id)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b');
\echo '62 members and trainers cannot map (expect RLS error twice); M sees own link only (expect 1), trainer sees 3'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into public.member_trainers (gym_id, member_id, trainer_id)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000b');
select count(*) as m_links from public.member_trainers;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.member_trainers (gym_id, member_id, trainer_id)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000b');
select count(*) as trainer_links from public.member_trainers;
\echo '63 mapping told M and the trainer (expect 1 each: Meet your trainer / New member)'
select title from public.notifications where kind = 'trainer_assigned' and title = 'New member' limit 1;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select title from public.notifications where kind = 'trainer_assigned';
\echo '64 trainer assigns a plan to mapped M (expect ok); to an unmapped member (expect RLS error)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.workout_assignments (workout_id, member_id) values (current_setting('test.plan')::uuid, '00000000-0000-0000-0000-00000000000c')
  on conflict do nothing returning true as ok;
insert into public.workout_assignments (workout_id, member_id) values (current_setting('test.plan')::uuid, '00000000-0000-0000-0000-000000000022');
\echo '65 unmapping M takes the trainer''s plans off M (expect DELETE 1, then 0 assignments for M)'
select pg_temp.as_user('00000000-0000-0000-0000-000000000020');
delete from public.member_trainers where member_id = '00000000-0000-0000-0000-00000000000c';
select count(*) as m_assignments from public.workout_assignments where member_id = '00000000-0000-0000-0000-00000000000c';
\echo '66 M asks for the trainer (expect ok), again (expect "already have a request"); trainer cannot ask (expect "Only members")'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select set_config('test.request', public.request_trainer('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', array['Weight loss'], 'Mornings please')::text, false) is not null as ok;
select public.request_trainer('10000000-0000-0000-0000-000000000001', null, array['Strength'], '');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.request_trainer('10000000-0000-0000-0000-000000000001', null, array['Strength'], '');
\echo '67 managers were told (expect 1 for supervisor); M2 cannot see the request (expect 0) or resolve it (expect "Request not found")'
select pg_temp.as_user('00000000-0000-0000-0000-000000000020');
select count(*) as sup_told from public.notifications where kind = 'trainer_request';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select count(*) as m2_sees from public.trainer_requests;
select public.resolve_trainer_request(current_setting('test.request')::uuid, true, '00000000-0000-0000-0000-00000000000b', '');
\echo '68 supervisor approves without a trainer (expect "Pick a trainer"), then with one (expect ok); M is mapped (expect 1) and told (expect approved)'
select pg_temp.as_user('00000000-0000-0000-0000-000000000020');
select public.resolve_trainer_request(current_setting('test.request')::uuid, true, null, '');
select public.resolve_trainer_request(current_setting('test.request')::uuid, true, '00000000-0000-0000-0000-00000000000b', 'Starts Monday');
select count(*) as m_mapped from public.member_trainers where member_id = '00000000-0000-0000-0000-00000000000c';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select body from public.notifications where title = 'Trainer request approved';
\echo '69 answering twice (expect "already answered"); M withdraws a new request (expect ok)'
select pg_temp.as_user('00000000-0000-0000-0000-000000000020');
select public.resolve_trainer_request(current_setting('test.request')::uuid, false, null, '');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.withdraw_trainer_request(public.request_trainer('10000000-0000-0000-0000-000000000001', null, array['Mobility'], ''));
select status from public.trainer_requests order by created_at desc limit 1;
\echo '70 supervisor messages the trainer (expect ok); a member cannot (expect "Only owners and supervisors"); trainer reads it (expect 1)'
select pg_temp.as_user('00000000-0000-0000-0000-000000000020');
select public.message_trainer('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Please schedule Saturday yoga', '');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.message_trainer('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Hi', '');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select count(*) as trainer_messages from public.notifications where kind = 'message';
\echo '71 trainer schedules own class (expect 1), edits it (expect UPDATE 1), cannot hand it to nobody (expect RLS error), cancels it (expect 1)'
select public.schedule_classes('10000000-0000-0000-0000-000000000001', 'Trainer yoga', '00000000-0000-0000-0000-00000000000b', now() + interval '3 days', 60, 10, 1);
update public.classes set capacity = 12 where title = 'Trainer yoga';
update public.classes set trainer_id = null where title = 'Trainer yoga';
select public.cancel_class((select id from public.classes where title = 'Trainer yoga'), false);
\echo '72 trainer cannot cancel a class they don''t teach (expect "Class not found")'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.schedule_classes('10000000-0000-0000-0000-000000000001', 'Open gym', null, now() + interval '3 days', 60, 10, 1);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.cancel_class((select id from public.classes where title = 'Open gym'), false);
\echo '73 M leaves the gym, so their trainer links go (expect 0)'
reset role;
delete from public.gym_members where user_id = '00000000-0000-0000-0000-00000000000c' and gym_id = '10000000-0000-0000-0000-000000000001';
select count(*) as links_left from public.member_trainers where member_id = '00000000-0000-0000-0000-00000000000c';
