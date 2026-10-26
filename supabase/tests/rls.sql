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

-- Olivia also runs CoreFit Gym itself, so she can add owners; checks 109+ cover owners who don't.
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000000a');

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
-- As the SQL editor would: no signed-in user.
select pg_temp.as_user('');
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

\echo '56 supervisor invites a member and a trainer (expect invited twice), not a supervisor (expect "Only owners can invite supervisors") or owner (expect "Only CoreFit Gym admins")'
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
\echo '74 workout history by role: setup (owner A, supervisor S, trainers T and T2, members P and Q; P has T and T2, Q has no trainer)'
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000030', 'tina@example.com', now(), '{"full_name":"Tina Two"}'),
  ('00000000-0000-0000-0000-000000000031', 'pia@example.com', now(), '{"full_name":"Pia Member"}'),
  ('00000000-0000-0000-0000-000000000032', 'quinn@example.com', now(), '{"full_name":"Quinn Member"}');
insert into public.gym_members (gym_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000030', 'trainer'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000031', 'member'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000032', 'member');
insert into public.member_trainers (gym_id, member_id, trainer_id) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-00000000000b'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000030');
delete from public.workout_logs;
set role authenticated;
\echo '75 owner, supervisor, trainer and members each log a workout (expect ok x6)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.workout_logs (client_id, gym_id, member_id, title, started_at, completed_at)
  values (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Owner day', now() - interval '1 hour', now()) returning true as owner_ok;
select pg_temp.as_user('00000000-0000-0000-0000-000000000020');
insert into public.workout_logs (client_id, gym_id, member_id, title, started_at, completed_at)
  values (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000020', 'Sup day', now() - interval '1 hour', now()) returning true as supervisor_ok;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.workout_logs (client_id, gym_id, member_id, title, started_at, completed_at)
  values (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Trainer day', now() - interval '1 hour', now()) returning true as trainer_ok;
insert into public.workout_log_sets (log_id, exercise_id, set_number, reps, weight_kg)
  select id, '30000000-0000-0000-0000-000000000001', 1, 5, 100 from public.workout_logs where title = 'Trainer day' returning true as trainer_set_ok;
select pg_temp.as_user('00000000-0000-0000-0000-000000000031');
insert into public.workout_logs (client_id, gym_id, member_id, title, started_at, completed_at)
  values (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000031', 'Pia day', now() - interval '1 hour', now()) returning true as pia_ok;
insert into public.workout_log_sets (log_id, exercise_id, set_number, reps, weight_kg)
  select id, '30000000-0000-0000-0000-000000000001', 1, 10, 20 from public.workout_logs where title = 'Pia day' returning true as pia_set_ok;
select pg_temp.as_user('00000000-0000-0000-0000-000000000032');
insert into public.workout_logs (client_id, gym_id, member_id, title, started_at, completed_at)
  values (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000032', 'Quinn day', now() - interval '1 hour', now()) returning true as quinn_ok;
\echo '76 staff cannot log as someone else or at a gym they are not in (expect RLS error x2)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.workout_logs (client_id, gym_id, member_id, title, started_at, completed_at)
  values (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000031', 'x', now(), now());
insert into public.workout_logs (client_id, gym_id, member_id, title, started_at, completed_at)
  values (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'x', now(), now());
\echo '77 owner sees all 5 logs (expect Owner day, Pia day, Quinn day, Sup day, Trainer day)'
select string_agg(title, ', ' order by title) as owner_sees from public.workout_logs;
\echo '78 supervisor sees own, trainer and members, not the owner (expect Pia day, Quinn day, Sup day, Trainer day)'
select pg_temp.as_user('00000000-0000-0000-0000-000000000020');
select string_agg(title, ', ' order by title) as supervisor_sees from public.workout_logs;
\echo '79 trainer T sees own and mapped member P only (expect Pia day, Trainer day; sets 2)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select string_agg(title, ', ' order by title) as trainer_sees from public.workout_logs;
select count(*) as trainer_sets from public.workout_log_sets;
\echo '80 second trainer T2 also sees P (expect Pia day); member Q sees only own (expect Quinn day)'
select pg_temp.as_user('00000000-0000-0000-0000-000000000030');
select string_agg(title, ', ' order by title) as t2_sees from public.workout_logs;
select pg_temp.as_user('00000000-0000-0000-0000-000000000032');
select string_agg(title, ', ' order by title) as quinn_sees from public.workout_logs;
\echo '81 trainer cannot change a member''s log (expect UPDATE 0)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
update public.workout_logs set title = 'hacked' where title = 'Pia day';
\echo '82 unmapping T from P hides P''s workouts from T (expect Trainer day)'
reset role;
delete from public.member_trainers where member_id = '00000000-0000-0000-0000-000000000031' and trainer_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select string_agg(title, ', ' order by title) as trainer_sees from public.workout_logs;
\echo '83 push tokens: M2 registers (expect ok), a bad token is refused (expect check error), outsider cannot read it (expect 0)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.register_push_token('ExponentPushToken[device-1]', 'android');
select public.register_push_token('not-a-token', 'android');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select count(*) as outsider_tokens from public.push_tokens;
\echo '84 same phone signs in as T2 and takes the token over (expect T2 sees 1, M2 sees 0); M2 cannot unregister it (expect still 1)'
select pg_temp.as_user('00000000-0000-0000-0000-000000000030');
select public.register_push_token('ExponentPushToken[device-1]', 'android');
select count(*) as t2_tokens from public.push_tokens;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select count(*) as m2_tokens from public.push_tokens;
select public.unregister_push_token('ExponentPushToken[device-1]');
reset role; select count(*) as tokens_left from public.push_tokens; set role authenticated;
\echo '85 members cannot run reminders or write inbox rows directly (expect permission denied, RLS error)'
select public.send_reminders();
insert into public.notifications (gym_id, recipient_id, kind, title) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'message', 'x');
\echo '86 owner schedules a class in 40 min and one tomorrow; M2 books both; reminders go to M2 and the trainer once (expect 1 and 1, then still 1 and 1)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.schedule_classes('10000000-0000-0000-0000-000000000001', 'Soon HIIT', '00000000-0000-0000-0000-00000000000b', now() + interval '40 minutes', 45, 10, 1);
select public.schedule_classes('10000000-0000-0000-0000-000000000001', 'Later HIIT', '00000000-0000-0000-0000-00000000000b', now() + interval '1 day', 45, 10, 1);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.book_class(id) is not null as booked from public.classes where title in ('Soon HIIT', 'Later HIIT');
reset role;
select public.send_reminders();
select public.send_reminders();
select count(*) filter (where recipient_id = '00000000-0000-0000-0000-00000000000d') as m2_reminded,
       count(*) filter (where recipient_id = '00000000-0000-0000-0000-00000000000b') as trainer_reminded
  from public.notifications where kind = 'reminder' and title like 'Soon HIIT%';
select count(*) as later_reminded from public.notifications where kind = 'reminder' and title like 'Later HIIT%';
set role authenticated;
\echo '87 owner moves then cancels the later class; M2 hears both and so does the trainer (expect Class moved, Class cancelled for each)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.classes set starts_at = starts_at + interval '1 hour' where title = 'Later HIIT';
select public.cancel_class((select id from public.classes where title = 'Later HIIT'), false);
reset role;
select r.full_name, string_agg(n.title, ', ' order by n.created_at, n.title) as heard
  from public.notifications n join public.profiles r on r.id = n.recipient_id
  where n.kind = 'booking' and n.body like 'Later HIIT%' group by r.full_name order by r.full_name;
set role authenticated;
\echo '88 M2 books T for a 1:1, then cancels it; T hears both (expect New session booked, Session cancelled)'
reset role;
delete from public.notifications where recipient_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select set_config('test.session', public.book_trainer_session('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','2026-11-03 17:00+05:30')::text, false) is not null as ok;
update public.trainer_sessions set status = 'cancelled' where id = current_setting('test.session')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select string_agg(title, ', ' order by created_at, title) as trainer_heard from public.notifications;
\echo '88b M2 books that slot again; 30 min before, both get a reminder naming the other (expect 2 rows)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.book_trainer_session('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','2026-11-03 17:00+05:30') is not null as ok;
reset role;
select public.send_reminders('2026-11-03 16:30+05:30');
select body from public.notifications where title = 'Session starts soon' order by body;
set role authenticated;
\echo '89 a membership is recorded for Q (expect Membership active); 3 days before the end, Q is reminded once after 9 am gym time, not before (expect 0, 1, 1)'
reset role;
insert into public.memberships (member_id, plan_id, starts_on, ends_on)
  select '00000000-0000-0000-0000-000000000032', id, '2026-10-01', '2026-10-30' from public.membership_plans
  where gym_id = '10000000-0000-0000-0000-000000000001' limit 1;
select title from public.notifications where kind = 'membership' and recipient_id = '00000000-0000-0000-0000-000000000032';
select public.send_reminders('2026-10-27 08:30+05:30');
select count(*) as before_nine from public.notifications where title = 'Membership ends soon' and recipient_id = '00000000-0000-0000-0000-000000000032';
select public.send_reminders('2026-10-27 09:05+05:30');
select public.send_reminders('2026-10-27 09:10+05:30');
select count(*) as after_nine from public.notifications where title = 'Membership ends soon' and recipient_id = '00000000-0000-0000-0000-000000000032';
\echo '89b Q renews past it, so the last-day reminder is skipped (expect 0)'
insert into public.memberships (member_id, plan_id, starts_on, ends_on)
  select '00000000-0000-0000-0000-000000000032', id, '2026-10-31', '2026-11-29' from public.membership_plans
  where gym_id = '10000000-0000-0000-0000-000000000001' limit 1;
select public.send_reminders('2026-10-30 10:00+05:30');
select count(*) as last_day from public.notifications where title = 'Membership ends today';
\echo '90 statement push trigger runs without Vault or pg_net (expect INSERT ok, no error)'
select public.notify('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'message', 'Push check', '');
\echo '91 Pia (mapped to T and T2) starts a workout without checking in today (expect Check in first)'
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000031');
select public.start_workout_attendance('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Leg day');
\echo '92 Pia checks in (expect member, not checked out), starts the same workout twice (T was unmapped in 82, so T2 is told once: 1)'
select role, checked_out_at is null as in_gym from public.check_in('10000000-0000-0000-0000-000000000001');
select public.start_workout_attendance('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Leg day');
select public.start_workout_attendance('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Leg day');
reset role;
select count(*) as told_started from public.notifications
  where kind = 'attendance' and dedupe_key = 'workout-start:40000000-0000-0000-0000-000000000001';
set role authenticated;
\echo '93 Pia finishes it; T2 hears it once and her day counts 2 workouts with Pia day (expect 2, 1)'
select pg_temp.as_user('00000000-0000-0000-0000-000000000031');
insert into public.workout_logs (client_id, gym_id, member_id, title, started_at, completed_at)
  values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000031', 'Leg day', now() - interval '45 minutes', now());
select workouts from public.my_attendance('10000000-0000-0000-0000-000000000001');
reset role;
select count(*) as told_finished from public.notifications
  where kind = 'attendance' and dedupe_key = 'workout-end:40000000-0000-0000-0000-000000000001';
set role authenticated;
\echo '94 Pia checks out (expect checked out), then starting another workout is refused (expect Check in first)'
select pg_temp.as_user('00000000-0000-0000-0000-000000000031');
select checked_out_at is not null as out from public.check_out('10000000-0000-0000-0000-000000000001');
select public.start_workout_attendance('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'Arms');
\echo '95 trainer T checks in and out (expect trainer, out), out again (expect Check in first); owner checks in (expect Only members and trainers)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select role from public.check_in('10000000-0000-0000-0000-000000000001');
select checked_out_at is not null as out from public.check_out('10000000-0000-0000-0000-000000000001');
select public.check_out('10000000-0000-0000-0000-000000000001');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.check_in('10000000-0000-0000-0000-000000000001');
\echo '96 supervisor reads today: Pia, Quinn (from Quinn day) and T present, absentees listed (expect 3, t); yesterday nobody (expect 0); member cannot (expect Only owners and supervisors)'
select pg_temp.as_user('00000000-0000-0000-0000-000000000020');
select string_agg(full_name || ':' || role, ', ' order by full_name) filter (where checked_in_at is not null) as present,
       count(*) filter (where checked_in_at is null) > 0 as lists_absent
  from public.gym_attendance('10000000-0000-0000-0000-000000000001');
select count(*) filter (where checked_in_at is not null) as yesterday
  from public.gym_attendance('10000000-0000-0000-0000-000000000001', 1);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select count(*) from public.gym_attendance('10000000-0000-0000-0000-000000000001');
\echo '97 attendance rows: member M2 sees none, owner sees Maya, Pia, Quinn and T (expect 0, 4); members cannot write rows (expect RLS error)'
select count(*) as m2_rows from public.attendance;
insert into public.attendance (gym_id, user_id, day, role, checked_in_at)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', current_date, 'member', now());
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select count(*) as owner_rows from public.attendance;
\echo '98 7-day report for the owner: Pia 1 day 2 workouts, T 1 day; a 0-day report is refused (expect Pia Member|1|2, Tom Trainer|1|0, then Pick between)'
select full_name, days_present, workouts from public.attendance_report('10000000-0000-0000-0000-000000000001', 7)
  where full_name in ('Pia Member', 'Tom Trainer') order by full_name;
select public.attendance_report('10000000-0000-0000-0000-000000000001', 0);
\echo '99 owner exports today: payments (expect > 0, every row from gym 1 plans), memberships per active member (expect > 0), attendance (expect 4 rows)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select count(*) > 0 as payments from public.export_payments('10000000-0000-0000-0000-000000000001', current_date - 1, current_date + 1);
select count(*) > 0 as members from public.export_memberships('10000000-0000-0000-0000-000000000001');
select count(*) as attendance from public.export_attendance('10000000-0000-0000-0000-000000000001', current_date - 1, current_date + 1);
\echo '100 owner exports a backwards period and over a year (expect Pick a start date, Export at most a year)'
select public.export_payments('10000000-0000-0000-0000-000000000001', current_date, current_date - 1);
select public.export_attendance('10000000-0000-0000-0000-000000000001', current_date - 400, current_date);
\echo '101 supervisor, trainer and member cannot export (expect Only the gym owner x4); owner of gym 1 cannot export gym 2 (expect Only the gym owner)'
select pg_temp.as_user('00000000-0000-0000-0000-000000000020');
select public.export_payments('10000000-0000-0000-0000-000000000001', current_date, current_date);
select public.export_memberships('10000000-0000-0000-0000-000000000001');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.export_attendance('10000000-0000-0000-0000-000000000001', current_date, current_date);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.export_payments('10000000-0000-0000-0000-000000000001', current_date, current_date);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.export_payments('10000000-0000-0000-0000-000000000002', current_date, current_date);
\echo '102 nobody calls the access check directly (expect permission denied)'
select public.check_report_access('10000000-0000-0000-0000-000000000001', current_date, current_date);

-- Owners and supervisors cover missing roles -----------------------------------------
set role authenticated;
select set_config('test.monday', ((date_trunc('week', now() at time zone 'Asia/Kolkata') + interval '7 days 07:00') at time zone 'Asia/Kolkata')::text, false) is not null as next_monday;
\echo '103 owner sets bookable hours (expect 1 window); Quinn books the owner (expect ok); the owner cannot book as a member (expect "Only members")'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.set_trainer_availability('10000000-0000-0000-0000-000000000001', 60, '[{"weekday":1,"start_time":"06:00","end_time":"09:00"}]');
select count(*) as owner_hours from public.trainer_availability where trainer_id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.as_user('00000000-0000-0000-0000-000000000032');
select public.book_trainer_session('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', current_setting('test.monday')::timestamptz) is not null as ok;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.book_trainer_session('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', current_setting('test.monday')::timestamptz);
\echo '104 owner maps Quinn to themself (expect INSERT), writes a plan and assigns it to her (expect ok)'
insert into public.member_trainers (gym_id, member_id, trainer_id)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-00000000000a');
select set_config('test.owner_plan', (
  select public.save_workout('10000000-0000-0000-0000-000000000001', null, 'Owner plan', '', 'beginner', 30,
    jsonb_build_array(jsonb_build_object('exercise_id', (select id from public.exercises limit 1), 'sets', 3, 'reps', 10, 'rest_seconds', 60)))
)::text, false) is not null as ok;
insert into public.workout_assignments (workout_id, member_id)
  values (current_setting('test.owner_plan')::uuid, '00000000-0000-0000-0000-000000000032') returning true as ok;
\echo '105 Quinn checks in and starts a workout; the owner, her coach, is told (expect 1)'
select pg_temp.as_user('00000000-0000-0000-0000-000000000032');
select role from public.check_in('10000000-0000-0000-0000-000000000001');
select public.start_workout_attendance('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'Owner plan');
reset role;
select count(*) as owner_told from public.notifications
  where recipient_id = '00000000-0000-0000-0000-00000000000a' and dedupe_key = 'workout-start:40000000-0000-0000-0000-000000000003';
set role authenticated;
\echo '106 supervisor maps Ravi to themself (expect INSERT), schedules their own class (expect 1), still not one for the trainer (expect RLS error)'
select pg_temp.as_user('00000000-0000-0000-0000-000000000020');
insert into public.member_trainers (gym_id, member_id, trainer_id)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000020');
select public.schedule_classes('10000000-0000-0000-0000-000000000001', 'Sam circuit', '00000000-0000-0000-0000-000000000020', now() + interval '2 days', 45, 10, 1);
select public.schedule_classes('10000000-0000-0000-0000-000000000001', 'Sup class 2', '00000000-0000-0000-0000-00000000000b', now() + interval '2 days', 45, 10, 1);
\echo '107 supervisor messages the owner (expect ok) but not themself (expect "Pick a trainer"); Ravi asks for the owner by name (expect ok)'
select public.message_trainer('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Your Monday client', '');
select public.message_trainer('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000020', 'Note to self', '');
select pg_temp.as_user('00000000-0000-0000-0000-000000000022');
select public.request_trainer('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', array['Strength'], '') is not null as ok;
\echo '108 supervisor made trainer keeps Ravi (expect 1); made member loses him (expect 0)'
reset role;
update public.gym_members set role = 'trainer' where user_id = '00000000-0000-0000-0000-000000000020';
select count(*) as kept from public.member_trainers where trainer_id = '00000000-0000-0000-0000-000000000020';
update public.gym_members set role = 'member' where user_id = '00000000-0000-0000-0000-000000000020';
select count(*) as dropped from public.member_trainers where trainer_id = '00000000-0000-0000-0000-000000000020';
\echo '109 member cannot invite a gym owner (expect "Only CoreFit Gym admins") or set up a gym (expect "Ask CoreFit Gym")'
reset role;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000099', 'grace@example.com', now(), '{"full_name":"Grace Newowner"}');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.invite_gym_owner('grace@example.com');
select public.create_gym('Sneaky Gym', '', '', '', '');
\echo '110 admin invites Grace to run a new gym (expect added); Grace can set one up (expect t)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.invite_gym_owner('Grace@Example.com ');
select pg_temp.as_user('00000000-0000-0000-0000-000000000099');
select public.can_set_up_gym();
\echo '111 Grace creates her gym (expect ok), is its owner, invite used up (expect f and 0 left), sees only her gym and herself'
select public.create_gym(' Iron House ', '12 Main Rd', 'Chennai', '9840012345', 'Desk@IronHouse.in') is not null as ok;
select g.name, g.city, g.email, gm.role from public.gyms g join public.gym_members gm on gm.gym_id = g.id;
select public.can_set_up_gym() as can_set_up_another;
reset role;
select count(*) as invite_left from public.gym_setup_invites;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000099');
select count(*) as members_seen from public.gym_members;
select full_name from public.profiles order by full_name;
\echo '112 Anna Nagar owner sees none of Grace''s gym (expect 0)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select count(*) as grace_gym_seen from public.gyms where name = 'Iron House';
\echo '113 Grace edits her gym (expect UPDATE 1), cannot rename the other gym (expect UPDATE 0) or change created_by (expect permission denied)'
select pg_temp.as_user('00000000-0000-0000-0000-000000000099');
update public.gyms set phone = '9840099999' where name = 'Iron House';
update public.gyms set name = 'Hacked' where id = '10000000-0000-0000-0000-000000000001';
update public.gyms set created_by = null where name = 'Iron House';
\echo '114 Grace is an owner but not an admin (expect f, and Olivia t)'
select public.is_platform_admin() as grace_admin;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.is_platform_admin() as olivia_admin;
\echo '115 Grace cannot invite a new gym owner, add an owner, or set up another gym (expect "Only CoreFit Gym admins" x2, f, "Ask CoreFit Gym")'
select pg_temp.as_user('00000000-0000-0000-0000-000000000099');
select public.invite_gym_owner('friend.gym@example.com');
select public.invite_to_gym((select id from public.gyms where name = 'Iron House'), 'friend.gym@example.com', 'owner');
select public.can_set_up_gym();
select public.create_gym('Second Branch', '', '', '', '');
\echo '116 Grace adds Xavier as a member (expect added), cannot make him owner (expect "Only CoreFit Gym admins") but can make him supervisor (expect UPDATE 1)'
select public.invite_to_gym((select id from public.gyms where name = 'Iron House'), 'xavier@example.com', 'member');
update public.gym_members set role = 'owner' where user_id = '00000000-0000-0000-0000-00000000000e' and gym_id = (select id from public.gyms where name = 'Iron House');
update public.gym_members set role = 'supervisor' where user_id = '00000000-0000-0000-0000-00000000000e' and gym_id = (select id from public.gyms where name = 'Iron House');
\echo '117 nobody makes themselves an admin from the app (expect permission denied)'
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-000000000099');

-- Enquiries ---------------------------------------------------------------------------
\echo '118 owner adds an enquiry (expect INSERT 0 1), trainer and member see none (expect 0, 0)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.enquiries (id, gym_id, full_name, phone, email, interest, next_follow_up_at)
values ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '  Kavya Nair ', '9840011111',
        'Kavya@Example.com', 'Weight loss, evenings', now() + interval '1 hour');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select count(*) as trainer_sees from public.enquiries;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select count(*) as member_sees from public.enquiries;
\echo '119 member cannot add one (expect "Assign an owner or supervisor")'
insert into public.enquiries (gym_id, full_name, phone) values ('10000000-0000-0000-0000-000000000001', 'Sneaky', '9840022222');
\echo '120 stored tidy and assigned to Olivia (expect Kavya Nair | kavya@example.com | t)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select full_name, email, assigned_to = created_by as assigned_to_creator from public.enquiries;
\echo '121 assigning a trainer, moving gyms, or linking by hand fail (expect 3 errors)'
update public.enquiries set assigned_to = '00000000-0000-0000-0000-00000000000b' where id = '50000000-0000-0000-0000-000000000001';
update public.enquiries set gym_id = '10000000-0000-0000-0000-000000000002' where id = '50000000-0000-0000-0000-000000000001';
update public.enquiries set member_id = '00000000-0000-0000-0000-00000000000c' where id = '50000000-0000-0000-0000-000000000001';
\echo '122 a call moves it to following up with two timeline lines (expect following_up | 2)'
select public.log_enquiry_follow_up('50000000-0000-0000-0000-000000000001', 'call', 'Wants a morning slot', now() + interval '2 hours');
select status, (select count(*) from public.enquiry_notes) as notes from public.enquiries;
\echo '123 follow-up in the past (expect "Pick a follow-up time"), trainer logs (expect "Enquiry not found")'
select public.log_enquiry_follow_up('50000000-0000-0000-0000-000000000001', 'note', '', now() - interval '1 day');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.log_enquiry_follow_up('50000000-0000-0000-0000-000000000001', 'note', 'hi', null);
\echo '124 reminders: none before it is due, one when due, still one on a rerun (expect 0, 1, 1)'
reset role;
select public.send_enquiry_reminders(now() + interval '1 hour');
select count(*) from public.notifications where dedupe_key like 'enquiry:%';
select public.send_enquiry_reminders(now() + interval '3 hours');
select count(*) from public.notifications where dedupe_key like 'enquiry:%';
select public.send_enquiry_reminders(now() + interval '3 hours 5 minutes');
select title, count(*) over () from public.notifications where dedupe_key like 'enquiry:%';
set role authenticated;
\echo '125 trial without dates (expect "Give the trial pass dates"), with dates (expect UPDATE 1 and a trial line)'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.enquiries set status = 'trial' where id = '50000000-0000-0000-0000-000000000001';
update public.enquiries set status = 'trial', trial_starts_on = current_date, trial_ends_on = current_date + 2
  where id = '50000000-0000-0000-0000-000000000001';
select body like 'Trial pass%' as trial_logged from public.enquiry_notes where kind = 'status' order by created_at desc limit 1;
\echo '126 she joins with the same email: linked and joined, follow-up cleared (expect joined | t | t | Joined the gym)'
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000050', 'kavya@example.com', '{"full_name":"Kavya Nair"}');
insert into public.gym_members (gym_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000050', 'member');
select status, member_id = '00000000-0000-0000-0000-000000000050' as linked, next_follow_up_at is null as cleared,
       (select body from public.enquiry_notes where kind = 'status' order by created_at desc, body limit 1)
from public.enquiries where id = '50000000-0000-0000-0000-000000000001';
set role authenticated;
\echo '127 owner of another gym sees none, and only owners delete (Grace 0; Tom DELETE 0; Olivia DELETE 1)'
select pg_temp.as_user('00000000-0000-0000-0000-000000000099');
select count(*) as other_gym_sees from public.enquiries;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
delete from public.enquiries;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
delete from public.enquiries;
