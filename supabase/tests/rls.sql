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
