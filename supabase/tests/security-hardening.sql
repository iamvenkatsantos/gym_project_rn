-- Security hardening: class_schedule runs as the caller, end_user_sessions() and trigger
-- functions aren't callable from the API. Self-contained: run after the migrations.
\set ON_ERROR_STOP 0
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
 ('c9000000-0000-0000-0000-00000000000a','owner@sh.test','{"full_name":"Sara Owner"}',now()),
 ('c9000000-0000-0000-0000-00000000000b','ben@sh.test','{"full_name":"Ben Member"}',now()),
 ('c9000000-0000-0000-0000-00000000000c','cat@sh.test','{"full_name":"Cat Member"}',now()),
 ('c9000000-0000-0000-0000-00000000000d','out@sh.test','{"full_name":"Oscar Outsider"}',now()),
 ('c9000000-0000-0000-0000-00000000000e','tia@sh.test','{"full_name":"Tia Trainer"}',now());
insert into public.brands (id, name) values ('c9300000-0000-0000-0000-000000000001','Safe Gym');
insert into public.gyms (id, name, brand_id, paid_until) values
 ('c9100000-0000-0000-0000-000000000001','Safe Gym','c9300000-0000-0000-0000-000000000001', current_date + 365);
insert into public.gym_members (gym_id, user_id, role) values
 ('c9100000-0000-0000-0000-000000000001','c9000000-0000-0000-0000-00000000000a','owner'),
 ('c9100000-0000-0000-0000-000000000001','c9000000-0000-0000-0000-00000000000b','member'),
 ('c9100000-0000-0000-0000-000000000001','c9000000-0000-0000-0000-00000000000c','member'),
 ('c9100000-0000-0000-0000-000000000001','c9000000-0000-0000-0000-00000000000e','trainer');
insert into public.classes (id, gym_id, trainer_id, title, starts_at, duration_minutes, capacity) values
 ('c9400000-0000-0000-0000-000000000001','c9100000-0000-0000-0000-000000000001',
  'c9000000-0000-0000-0000-00000000000e','Spin',now() + interval '2 days',45,1);
insert into public.bookings (class_id, member_id, status, waitlisted_at) values
 ('c9400000-0000-0000-0000-000000000001','c9000000-0000-0000-0000-00000000000b','booked',null),
 ('c9400000-0000-0000-0000-000000000001','c9000000-0000-0000-0000-00000000000c','waitlisted',now());

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;

\echo 'S1 class_schedule runs as the caller (expect {security_invoker=on})'
select reloptions from pg_class where oid = 'public.class_schedule'::regclass;

set role authenticated;
\echo 'S2 Ben sees the class with everyone counted and the trainer named (expect Spin | Tia Trainer | 1 | 1)'
select pg_temp.as_user('c9000000-0000-0000-0000-00000000000b');
select title, trainer_name, booked_count, waitlist_count from public.class_schedule
where id = 'c9400000-0000-0000-0000-000000000001';

\echo 'S3 Ben still reads only his own booking (expect 1)'
select count(*) from public.bookings where class_id = 'c9400000-0000-0000-0000-000000000001';

\echo 'S4 An outsider sees no classes and no counts (expect 0, then 0)'
select pg_temp.as_user('c9000000-0000-0000-0000-00000000000d');
select count(*) from public.class_schedule where gym_id = 'c9100000-0000-0000-0000-000000000001';
select public.class_booking_count('c9400000-0000-0000-0000-000000000001', 'booked');

\echo 'S5 Nobody signed in can end sessions (expect permission denied for function end_user_sessions)'
select public.end_user_sessions('c9000000-0000-0000-0000-00000000000b');

\echo 'S6 Trigger functions aren''t callable (expect permission denied for function handle_new_user)'
select public.handle_new_user();
reset role;

\echo 'S7 No trigger function in public is executable by anon or authenticated (expect 0)'
select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
  and (has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('authenticated', p.oid, 'execute'));

\echo 'S8 The service side ends every session (expect 0 left for Ben, 1 for Cat)'
create table if not exists auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid);
create table if not exists auth.refresh_tokens (id bigserial primary key, user_id varchar(255));
insert into auth.sessions (user_id) values
 ('c9000000-0000-0000-0000-00000000000b'),('c9000000-0000-0000-0000-00000000000b'),('c9000000-0000-0000-0000-00000000000c');
insert into auth.refresh_tokens (user_id) values ('c9000000-0000-0000-0000-00000000000b');
select public.end_user_sessions('c9000000-0000-0000-0000-00000000000b');
select (select count(*) from auth.sessions where user_id = 'c9000000-0000-0000-0000-00000000000b')
     + (select count(*) from auth.refresh_tokens where user_id = 'c9000000-0000-0000-0000-00000000000b') as ben,
       (select count(*) from auth.sessions where user_id = 'c9000000-0000-0000-0000-00000000000c') as cat;
