-- Gym logo: only the platform admin sets it, it must sit in the gym's own folder, everyone at the
-- branch reads it. Self-contained: run after the migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, raw_user_meta_data) values
 ('f6000000-0000-0000-0000-00000000000a','{"full_name":"Lia Owner"}'),
 ('f6000000-0000-0000-0000-00000000000b','{"full_name":"Lou Member"}'),
 ('f6000000-0000-0000-0000-00000000000c','{"full_name":"Lee Trainer"}'),
 ('f6000000-0000-0000-0000-00000000000d','{"full_name":"Ada Admin"}');
insert into public.platform_admins (user_id) values ('f6000000-0000-0000-0000-00000000000d');
insert into public.brands (id, name) values ('f6300000-0000-0000-0000-000000000001','Logo Gym');
insert into public.gyms (id, name, brand_id) values
 ('f6100000-0000-0000-0000-000000000001','Logo Gym','f6300000-0000-0000-0000-000000000001');
insert into public.gym_members (gym_id, user_id, role) values
 ('f6100000-0000-0000-0000-000000000001','f6000000-0000-0000-0000-00000000000a','owner'),
 ('f6100000-0000-0000-0000-000000000001','f6000000-0000-0000-0000-00000000000b','member'),
 ('f6100000-0000-0000-0000-000000000001','f6000000-0000-0000-0000-00000000000c','trainer');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'T1 Owner, member and trainer can''t set it (expect Only the platform admin changes the gym logo, three times)'
select pg_temp.as_user('f6000000-0000-0000-0000-00000000000a');
select public.set_gym_logo('f6100000-0000-0000-0000-000000000001', 'f6100000-0000-0000-0000-000000000001/a.png');
select pg_temp.as_user('f6000000-0000-0000-0000-00000000000b');
select public.set_gym_logo('f6100000-0000-0000-0000-000000000001', 'f6100000-0000-0000-0000-000000000001/a.png');
select pg_temp.as_user('f6000000-0000-0000-0000-00000000000c');
select public.set_gym_logo('f6100000-0000-0000-0000-000000000001', 'f6100000-0000-0000-0000-000000000001/a.png');

\echo 'T2 Nobody updates the column directly, not even the owner (expect permission denied)'
select pg_temp.as_user('f6000000-0000-0000-0000-00000000000a');
update public.gyms set logo_path = 'x' where id = 'f6100000-0000-0000-0000-000000000001';

\echo 'T3 Only the admin reads it through admin_gym_logo (expect Only the platform admin reads this)'
select public.admin_gym_logo('f6100000-0000-0000-0000-000000000001');

\echo 'T4 A path outside the gym''s folder is refused (expect The logo must be in the gym''s own folder)'
select pg_temp.as_user('f6000000-0000-0000-0000-00000000000d');
select public.set_gym_logo('f6100000-0000-0000-0000-000000000001', 'f6100000-0000-0000-0000-000000000002/a.png');

\echo 'T5 The admin sets it, the member and the admin read it (expect the path twice)'
select public.set_gym_logo('f6100000-0000-0000-0000-000000000001', 'f6100000-0000-0000-0000-000000000001/a.png');
select public.admin_gym_logo('f6100000-0000-0000-0000-000000000001');
select pg_temp.as_user('f6000000-0000-0000-0000-00000000000b');
select logo_path from public.gyms where id = 'f6100000-0000-0000-0000-000000000001';

\echo 'T6 The admin removes it (expect null)'
select pg_temp.as_user('f6000000-0000-0000-0000-00000000000d');
select public.set_gym_logo('f6100000-0000-0000-0000-000000000001', null);
select public.admin_gym_logo('f6100000-0000-0000-0000-000000000001');
reset role;
