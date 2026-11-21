-- Gym theme colour: only owners set it, everyone at the branch reads it.
-- Self-contained: run after the migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, raw_user_meta_data) values
 ('f5000000-0000-0000-0000-00000000000a','{"full_name":"Tia Owner"}'),
 ('f5000000-0000-0000-0000-00000000000b','{"full_name":"Tom Member"}'),
 ('f5000000-0000-0000-0000-00000000000c','{"full_name":"Tara Trainer"}'),
 ('f5000000-0000-0000-0000-00000000000d','{"full_name":"Tess Supervisor"}');
insert into public.brands (id, name) values ('f5300000-0000-0000-0000-000000000001','Theme Gym');
insert into public.gyms (id, name, brand_id) values
 ('f5100000-0000-0000-0000-000000000001','Theme Gym','f5300000-0000-0000-0000-000000000001');
insert into public.gym_members (gym_id, user_id, role) values
 ('f5100000-0000-0000-0000-000000000001','f5000000-0000-0000-0000-00000000000a','owner'),
 ('f5100000-0000-0000-0000-000000000001','f5000000-0000-0000-0000-00000000000b','member'),
 ('f5100000-0000-0000-0000-000000000001','f5000000-0000-0000-0000-00000000000c','trainer'),
 ('f5100000-0000-0000-0000-000000000001','f5000000-0000-0000-0000-00000000000d','supervisor');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'T1 A new branch is green (expect green)'
select pg_temp.as_user('f5000000-0000-0000-0000-00000000000b');
select theme_color from public.gyms where id = 'f5100000-0000-0000-0000-000000000001';

\echo 'T2 Member, trainer and supervisor can''t set it (expect Only owners change the theme colour, three times)'
select public.set_gym_theme_color('f5100000-0000-0000-0000-000000000001', 'blue');
select pg_temp.as_user('f5000000-0000-0000-0000-00000000000c');
select public.set_gym_theme_color('f5100000-0000-0000-0000-000000000001', 'blue');
select pg_temp.as_user('f5000000-0000-0000-0000-00000000000d');
select public.set_gym_theme_color('f5100000-0000-0000-0000-000000000001', 'blue');

\echo 'T3 Nobody updates the column directly (expect permission denied)'
select pg_temp.as_user('f5000000-0000-0000-0000-00000000000a');
update public.gyms set theme_color = 'pink' where id = 'f5100000-0000-0000-0000-000000000001';

\echo 'T4 An unknown colour is refused (expect Unknown theme colour, twice)'
select public.set_gym_theme_color('f5100000-0000-0000-0000-000000000001', 'teal');
select public.set_gym_theme_color('f5100000-0000-0000-0000-000000000001', null);

\echo 'T5 The owner sets purple and the member reads it (expect purple)'
select public.set_gym_theme_color('f5100000-0000-0000-0000-000000000001', 'purple');
select pg_temp.as_user('f5000000-0000-0000-0000-00000000000b');
select theme_color from public.gyms where id = 'f5100000-0000-0000-0000-000000000001';
reset role;
