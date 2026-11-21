-- Gym tagline: only the platform admin sets it (max 60 characters), everyone at the branch reads it,
-- and the receipt carries the logo path. Self-contained: run after the migrations.
\set ON_ERROR_STOP 0
insert into auth.users (id, raw_user_meta_data) values
 ('f7000000-0000-0000-0000-00000000000a','{"full_name":"Tia Owner"}'),
 ('f7000000-0000-0000-0000-00000000000b','{"full_name":"Tom Member"}'),
 ('f7000000-0000-0000-0000-00000000000d','{"full_name":"Ada Admin"}');
insert into public.platform_admins (user_id) values ('f7000000-0000-0000-0000-00000000000d');
insert into public.brands (id, name) values ('f7300000-0000-0000-0000-000000000001','Tag Gym');
insert into public.gyms (id, name, brand_id) values
 ('f7100000-0000-0000-0000-000000000001','Tag Gym','f7300000-0000-0000-0000-000000000001');
insert into public.gym_members (gym_id, user_id, role) values
 ('f7100000-0000-0000-0000-000000000001','f7000000-0000-0000-0000-00000000000a','owner'),
 ('f7100000-0000-0000-0000-000000000001','f7000000-0000-0000-0000-00000000000b','member');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'T1 Owner and member can''t set it (expect Only the platform admin changes the gym tagline, twice)'
select pg_temp.as_user('f7000000-0000-0000-0000-00000000000a');
select public.set_gym_tagline('f7100000-0000-0000-0000-000000000001', 'Hi');
select pg_temp.as_user('f7000000-0000-0000-0000-00000000000b');
select public.set_gym_tagline('f7100000-0000-0000-0000-000000000001', 'Hi');

\echo 'T2 Nobody updates the column directly (expect permission denied)'
select pg_temp.as_user('f7000000-0000-0000-0000-00000000000a');
update public.gyms set tagline = 'x' where id = 'f7100000-0000-0000-0000-000000000001';

\echo 'T3 Only the admin reads it with admin_gym_tagline (expect Only the platform admin reads this)'
select public.admin_gym_tagline('f7100000-0000-0000-0000-000000000001');

\echo 'T4 Too long is refused (expect The tagline can be 60 characters at most)'
select pg_temp.as_user('f7000000-0000-0000-0000-00000000000d');
select public.set_gym_tagline('f7100000-0000-0000-0000-000000000001', repeat('a', 61));

\echo 'T5 The admin sets it (trimmed) and the member reads it (expect Train hard)'
select public.set_gym_tagline('f7100000-0000-0000-0000-000000000001', '  Train hard  ');
select pg_temp.as_user('f7000000-0000-0000-0000-00000000000b');
select tagline from public.gyms where id = 'f7100000-0000-0000-0000-000000000001';

\echo 'T6 Blank clears it (expect null)'
select pg_temp.as_user('f7000000-0000-0000-0000-00000000000d');
select public.set_gym_tagline('f7100000-0000-0000-0000-000000000001', '   ');
select public.admin_gym_tagline('f7100000-0000-0000-0000-000000000001');
reset role;
