-- Self workouts: the switch, a member's own plans, the self-check and trainer replies.
-- Self-contained: run after the migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, raw_user_meta_data, email_confirmed_at) values
 ('d8000000-0000-0000-0000-00000000000a','{"full_name":"Oli Owner"}',now()),
 ('d8000000-0000-0000-0000-00000000000b','{"full_name":"Tara Trainer"}',now()),
 ('d8000000-0000-0000-0000-00000000000d','{"full_name":"Other Trainer"}',now()),
 ('d8000000-0000-0000-0000-00000000000c','{"full_name":"Max Member"}',now()),
 ('d8000000-0000-0000-0000-00000000000e','{"full_name":"Eve Member"}',now()),
 ('d8000000-0000-0000-0000-00000000000f','{"full_name":"Sam Supervisor"}',now());
insert into public.brands (id, name) values ('d8300000-0000-0000-0000-000000000001','Self Gym');
insert into public.gyms (id, name, brand_id) values
 ('d8100000-0000-0000-0000-000000000001','Self Gym','d8300000-0000-0000-0000-000000000001');
insert into public.gym_members (gym_id, user_id, role) values
 ('d8100000-0000-0000-0000-000000000001','d8000000-0000-0000-0000-00000000000a','owner'),
 ('d8100000-0000-0000-0000-000000000001','d8000000-0000-0000-0000-00000000000b','trainer'),
 ('d8100000-0000-0000-0000-000000000001','d8000000-0000-0000-0000-00000000000d','trainer'),
 ('d8100000-0000-0000-0000-000000000001','d8000000-0000-0000-0000-00000000000c','member'),
 ('d8100000-0000-0000-0000-000000000001','d8000000-0000-0000-0000-00000000000e','member'),
 ('d8100000-0000-0000-0000-000000000001','d8000000-0000-0000-0000-00000000000f','supervisor');
-- Max is Tara's member; Eve is Other Trainer's.
insert into public.member_trainers (gym_id, member_id, trainer_id) values
 ('d8100000-0000-0000-0000-000000000001','d8000000-0000-0000-0000-00000000000c','d8000000-0000-0000-0000-00000000000b'),
 ('d8100000-0000-0000-0000-000000000001','d8000000-0000-0000-0000-00000000000e','d8000000-0000-0000-0000-00000000000d');
insert into public.exercises (id, gym_id, name, muscle_groups, equipment, difficulty) values
 ('d8400000-0000-0000-0000-000000000001', null, 'Self squat', '{legs}', 'barbell', 'beginner'),
 ('d8400000-0000-0000-0000-000000000002', null, 'Self row', '{back}', 'dumbbell', 'beginner');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'S1 before it is on, Max cannot build a plan (expect an error)'
select pg_temp.as_user('d8000000-0000-0000-0000-00000000000c');
select public.create_self_plan('d8100000-0000-0000-0000-000000000001', 'stay_fit', 'beginner', '{1,3,5}', 'full_body',
  '[{"title":"Legs","description":"","level":"beginner","duration_minutes":40,"days":[1,3,5],"exercises":[{"exercise_id":"d8400000-0000-0000-0000-000000000001","sets":3,"reps":10,"target_weight_kg":null,"rest_seconds":90}]}]');

\echo 'S2 Max cannot switch it on himself, nor can another member''s trainer or the owner (expect three errors)'
select public.set_self_workouts('d8100000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-00000000000c', true);
select pg_temp.as_user('d8000000-0000-0000-0000-00000000000d');
select public.set_self_workouts('d8100000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-00000000000c', true);
select pg_temp.as_user('d8000000-0000-0000-0000-00000000000a');
select public.set_self_workouts('d8100000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-00000000000c', true);

\echo 'S3 Tara switches it on; Max is told (expect t, then 1)'
select pg_temp.as_user('d8000000-0000-0000-0000-00000000000b');
select public.set_self_workouts('d8100000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-00000000000c', true);
select public.self_workouts_on('d8100000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-00000000000c');
select pg_temp.as_user('d8000000-0000-0000-0000-00000000000c');
select count(*) from public.notifications where recipient_id = 'd8000000-0000-0000-0000-00000000000c' and kind = 'workout';

\echo 'S4 Max builds two plans, assigned to himself with their days (expect 2 rows: {1,4} and {2,5})'
select public.create_self_plan('d8100000-0000-0000-0000-000000000001', 'gain_muscle', 'beginner', '{1,2,4,5}', 'split',
  '[{"title":"Legs","description":"","level":"beginner","duration_minutes":40,"days":[1,4],"exercises":[{"exercise_id":"d8400000-0000-0000-0000-000000000001","sets":3,"reps":10,"target_weight_kg":null,"rest_seconds":90}]},
    {"title":"Back","description":"","level":"beginner","duration_minutes":40,"days":[2,5],"exercises":[{"exercise_id":"d8400000-0000-0000-0000-000000000002","sets":3,"reps":12,"target_weight_kg":null,"rest_seconds":60}]}]');
select w.title, a.days from public.workouts w join public.workout_assignments a on a.workout_id = w.id
  where w.is_self order by w.title;

\echo 'S5 rebuilding replaces the old plans (expect 1 plan, Full body)'
select public.create_self_plan('d8100000-0000-0000-0000-000000000001', 'stay_fit', 'beginner', '{1,3,5}', 'full_body',
  '[{"title":"Full body","description":"","level":"beginner","duration_minutes":45,"days":[1,3,5],"exercises":[{"exercise_id":"d8400000-0000-0000-0000-000000000001","sets":3,"reps":10,"target_weight_kg":null,"rest_seconds":90},{"exercise_id":"d8400000-0000-0000-0000-000000000002","sets":3,"reps":10,"target_weight_kg":null,"rest_seconds":90}]}]');
select title from public.workouts where is_self;

\echo 'S6 Max cannot write a plan row directly (expect an RLS error)'
insert into public.workouts (gym_id, trainer_id, is_self, title, duration_minutes)
  values ('d8100000-0000-0000-0000-000000000001','d8000000-0000-0000-0000-00000000000c', true, 'Sneaky', 30);

\echo 'S7 Tara, the owner and supervisor see Max''s plan and days; the other trainer and Eve don''t (expect 1, 1, 1, 0, 0)'
select pg_temp.as_user('d8000000-0000-0000-0000-00000000000b');
select count(*) from public.workouts w join public.workout_assignments a on a.workout_id = w.id where w.is_self;
select pg_temp.as_user('d8000000-0000-0000-0000-00000000000a');
select count(*) from public.workouts where is_self;
select pg_temp.as_user('d8000000-0000-0000-0000-00000000000f');
select count(*) from public.workouts where is_self;
select pg_temp.as_user('d8000000-0000-0000-0000-00000000000d');
select count(*) from public.workouts where is_self;
select pg_temp.as_user('d8000000-0000-0000-0000-00000000000e');
select count(*) from public.workouts where is_self;

\echo 'S8 Tara edits Max''s plan and Max is told; the other trainer cannot (expect a uuid, 1 more notification, then an error)'
select pg_temp.as_user('d8000000-0000-0000-0000-00000000000b');
select public.save_self_workout('d8100000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-00000000000c',
  (select id from public.workouts where is_self), 'Full body plus', '', 'beginner', 50,
  '[{"exercise_id":"d8400000-0000-0000-0000-000000000001","sets":4,"reps":8,"target_weight_kg":40,"rest_seconds":120}]', '{1,3,5}') is not null;
select pg_temp.as_user('d8000000-0000-0000-0000-00000000000c');
select count(*) from public.notifications where recipient_id = 'd8000000-0000-0000-0000-00000000000c' and kind = 'workout';
select pg_temp.as_user('d8000000-0000-0000-0000-00000000000d');
select public.save_self_workout('d8100000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-00000000000c',
  null, 'Nope', '', 'beginner', 50,
  '[{"exercise_id":"d8400000-0000-0000-0000-000000000001","sets":4,"reps":8,"target_weight_kg":null,"rest_seconds":120}]', '{}');

\echo 'S9 Max logs a workout with a self-check and tries to write his own reply (expect effort 8, pain knee, reply empty)'
select pg_temp.as_user('d8000000-0000-0000-0000-00000000000c');
insert into public.workout_logs (client_id, gym_id, member_id, workout_id, title, started_at, completed_at, effort, pain, note, coach_reply)
  values ('d8500000-0000-0000-0000-000000000001','d8100000-0000-0000-0000-000000000001','d8000000-0000-0000-0000-00000000000c',
          (select id from public.workouts where is_self), 'Full body plus', now() - interval '50 minutes', now(), 8, 'knee', 'Felt strong', 'Great job me');
select effort, pain, coalesce(coach_reply, '(none)') from public.workout_logs where client_id = 'd8500000-0000-0000-0000-000000000001';

\echo 'S10 Tara''s push carries the self-check (expect a body with Effort 8/10 and Pain: knee)'
reset role;
select body like '%Effort 8/10.%Pain: knee.%' from public.notifications
  where recipient_id = 'd8000000-0000-0000-0000-00000000000b' and title like '%finished a workout';
set role authenticated;

\echo 'S11 an effort of 11 is refused (expect a check constraint error)'
update public.workout_logs set effort = 11 where client_id = 'd8500000-0000-0000-0000-000000000001';

\echo 'S12 the other trainer and Max cannot reply; Tara can (expect two errors, then Tara''s reply)'
select pg_temp.as_user('d8000000-0000-0000-0000-00000000000d');
select public.reply_to_workout('d8500000-0000-0000-0000-000000000001', 'Hi');
select pg_temp.as_user('d8000000-0000-0000-0000-00000000000c');
select public.reply_to_workout('d8500000-0000-0000-0000-000000000001', 'Hi');
select pg_temp.as_user('d8000000-0000-0000-0000-00000000000b');
select public.reply_to_workout('d8500000-0000-0000-0000-000000000001', 'Ice the knee, rest tomorrow');
select coach_reply, replied_by_name from public.workout_logs where client_id = 'd8500000-0000-0000-0000-000000000001';

\echo 'S13 Max cannot overwrite the reply (expect UPDATE 1 but the reply unchanged)'
select pg_temp.as_user('d8000000-0000-0000-0000-00000000000c');
update public.workout_logs set coach_reply = 'Edited', note = 'Felt strong!'
  where client_id = 'd8500000-0000-0000-0000-000000000001';
select coach_reply, note from public.workout_logs where client_id = 'd8500000-0000-0000-0000-000000000001';

\echo 'S14 switched off, Max can''t edit or delete his plan but Tara still can (expect two errors, then a deleted plan: 0)'
select pg_temp.as_user('d8000000-0000-0000-0000-00000000000b');
select public.set_self_workouts('d8100000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-00000000000c', false);
select pg_temp.as_user('d8000000-0000-0000-0000-00000000000c');
select public.save_self_workout('d8100000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-00000000000c',
  (select id from public.workouts where is_self), 'Mine', '', 'beginner', 50,
  '[{"exercise_id":"d8400000-0000-0000-0000-000000000001","sets":4,"reps":8,"target_weight_kg":null,"rest_seconds":120}]', '{1}');
select public.delete_self_workout((select id from public.workouts where is_self));
select pg_temp.as_user('d8000000-0000-0000-0000-00000000000b');
select public.delete_self_workout((select id from public.workouts where is_self));
select count(*) from public.workouts where is_self;

reset role;
