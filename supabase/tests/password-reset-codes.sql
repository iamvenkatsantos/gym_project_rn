-- Password reset codes for mobile sign-ins. Self-contained: run after the
-- migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('fd100000-0000-0000-0000-00000000000a','owner@pr.test',now(),'{"full_name":"Pia Owner"}'),
 ('fd100000-0000-0000-0000-00000000000d','sup@pr.test',now(),'{"full_name":"Sid Supervisor"}'),
 ('fd100000-0000-0000-0000-00000000000c','coach@pr.test',now(),'{"full_name":"Cal Coach"}'),
 ('fd100000-0000-0000-0000-000000000011','9840033333@m.vinven.net',now(),'{"full_name":"Mohan Mobile"}'),
 ('fd100000-0000-0000-0000-000000000012','email@pr.test',now(),'{"full_name":"Esa Email"}'),
 ('fd100000-0000-0000-0000-000000000013','9840044444@m.vinven.net',now(),'{"full_name":"Oli Co-owner"}');
insert into public.brands (id, name) values ('fd200000-0000-0000-0000-000000000001','PR Gym');
insert into public.gyms (id, name, brand_id) values
 ('fd300000-0000-0000-0000-000000000001','PR Gym Tambaram','fd200000-0000-0000-0000-000000000001');
insert into public.gym_members (gym_id, user_id, role) values
 ('fd300000-0000-0000-0000-000000000001','fd100000-0000-0000-0000-00000000000a','owner'),
 ('fd300000-0000-0000-0000-000000000001','fd100000-0000-0000-0000-00000000000d','supervisor'),
 ('fd300000-0000-0000-0000-000000000001','fd100000-0000-0000-0000-00000000000c','trainer'),
 ('fd300000-0000-0000-0000-000000000001','fd100000-0000-0000-0000-000000000011','member'),
 ('fd300000-0000-0000-0000-000000000001','fd100000-0000-0000-0000-000000000012','member'),
 ('fd300000-0000-0000-0000-000000000001','fd100000-0000-0000-0000-000000000013','owner');
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'R1 A trainer can''t make one (expect Only owners and supervisors can reset passwords)'
select pg_temp.as_user('fd100000-0000-0000-0000-00000000000c');
select public.create_password_reset_code('fd300000-0000-0000-0000-000000000001', 'fd100000-0000-0000-0000-000000000011');

\echo 'R2 Not for email sign-ins (expect They sign in with email. Ask them to tap Forgot password.)'
select pg_temp.as_user('fd100000-0000-0000-0000-00000000000d');
select public.create_password_reset_code('fd300000-0000-0000-0000-000000000001', 'fd100000-0000-0000-0000-000000000012');

\echo 'R3 A supervisor can''t reset an owner (expect Only owners can reset an owner''s password)'
select public.create_password_reset_code('fd300000-0000-0000-0000-000000000001', 'fd100000-0000-0000-0000-000000000013');

\echo 'R4 The supervisor makes one for a mobile member (expect t)'
select public.create_password_reset_code('fd300000-0000-0000-0000-000000000001', 'fd100000-0000-0000-0000-000000000011') ~ '^[A-HJ-NP-Z2-9]{8}$';

\echo 'R5 Nobody reads the codes directly, nor looks one up (expect permission denied twice)'
select count(*) from public.password_reset_codes;
select * from public.reset_code_account('AAAAAAAA');

\echo 'R6 A new code replaces the old one (expect 1)'
select public.create_password_reset_code('fd300000-0000-0000-0000-000000000001', 'fd100000-0000-0000-0000-000000000011') is not null;
reset role;
select count(*) from public.password_reset_codes where user_id = 'fd100000-0000-0000-0000-000000000011';

\echo 'R7 The service role finds the account by code, in any spelling (expect 9840033333@m.vinven.net)'
select email from public.reset_code_account(
  (select lower(substr(code, 1, 4) || '-' || substr(code, 5)) from public.password_reset_codes limit 1));

\echo 'R8 Expired codes don''t work (expect 0)'
update public.password_reset_codes set expires_at = now() - interval '1 minute' where user_id = 'fd100000-0000-0000-0000-000000000011';
select count(*) from public.reset_code_account((select code from public.password_reset_codes limit 1));
