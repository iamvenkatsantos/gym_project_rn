-- Who can read workout plans. Self-contained: run after the migrations (rls.sql is optional).
-- Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, raw_user_meta_data) values
 ('e0000000-0000-0000-0000-00000000000a','{"full_name":"Wes Owner"}'),
 ('e0000000-0000-0000-0000-00000000000b','{"full_name":"Tara Trainer"}'),
 ('e0000000-0000-0000-0000-00000000000c','{"full_name":"Ravi Member"}'),
 ('e0000000-0000-0000-0000-00000000000d','{"full_name":"Sana Member"}'),
 ('e0000000-0000-0000-0000-00000000000e','{"full_name":"Kiran Trainer"}'),
 ('e0000000-0000-0000-0000-00000000000f','{"full_name":"Suri Supervisor"}');
insert into public.gyms (id, name) values ('e1000000-0000-0000-0000-000000000001','Plan Gym');
insert into public.gym_members (gym_id, user_id, role) values
 ('e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000a','owner'),
 ('e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000b','trainer'),
 ('e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000c','member'),
 ('e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000d','member'),
 ('e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000e','trainer'),
 ('e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000f','supervisor');
-- Ravi trains with Tara; Sana with Kiran.
insert into public.member_trainers (gym_id, member_id, trainer_id) values
 ('e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000c','e0000000-0000-0000-0000-00000000000b'),
 ('e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000d','e0000000-0000-0000-0000-00000000000e');
insert into public.workouts (id, gym_id, trainer_id, title, duration_minutes) values
 ('e2000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000b','Tara push',45),
 ('e2000000-0000-0000-0000-000000000002','e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000b','Tara pull',45),
 ('e2000000-0000-0000-0000-000000000003','e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000e','Kiran legs',60);
insert into public.workout_assignments (workout_id, member_id) values
 ('e2000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000c');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'W1 Tara sees only her own plans (expect Tara pull, Tara push)'
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000b');
select string_agg(title, ', ' order by title) from public.workouts;

\echo 'W2 Ravi sees his trainer Tara''s plans, not Kiran''s (expect Tara pull, Tara push)'
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000c');
select string_agg(title, ', ' order by title) from public.workouts;

\echo 'W3 Sana sees Kiran''s plan only (expect Kiran legs)'
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000d');
select string_agg(title, ', ' order by title) from public.workouts;

\echo 'W4 the supervisor and the owner see every plan (expect 3, 3)'
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000f');
select count(*) from public.workouts;
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000a');
select count(*) from public.workouts;

\echo 'W5 the supervisor cannot edit Tara''s plan (expect 0 rows updated)'
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000f');
update public.workouts set title = 'Hijacked' where id = 'e2000000-0000-0000-0000-000000000001';

\echo 'W6 unmapping Tara from Ravi hides her plans from him (expect null)'
reset role;
delete from public.member_trainers
  where member_id = 'e0000000-0000-0000-0000-00000000000c' and trainer_id = 'e0000000-0000-0000-0000-00000000000b';
set role authenticated;
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000c');
select string_agg(title, ', ' order by title) from public.workouts;
