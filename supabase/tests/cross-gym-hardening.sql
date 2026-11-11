-- Cross-gym hardening (issues #114, #115, #117). Self-contained: run after the
-- migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
\set ON_ERROR_ROLLBACK on
begin;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('e7000000-0000-0000-0000-00000000000a','ownera@xg.test',now(),'{"full_name":"Owner A"}'),
 ('e7000000-0000-0000-0000-00000000000b','ownerb@xg.test',now(),'{"full_name":"Owner B"}'),
 ('e7000000-0000-0000-0000-00000000000d','supa@xg.test',now(),'{"full_name":"Sup A"}'),
 ('e7000000-0000-0000-0000-00000000000c','trainera@xg.test',now(),'{"full_name":"Trainer A"}'),
 ('e7000000-0000-0000-0000-000000000011','9840077777@m.vinven.net',now(),'{"full_name":"Mobile Co-owner B"}'),
 ('e7000000-0000-0000-0000-000000000012','9840088888@m.vinven.net',now(),'{"full_name":"Mobile Member A"}'),
 ('e7000000-0000-0000-0000-000000000099','stranger@xg.test',now(),'{"full_name":"Stranger"}');
insert into public.brands (id, name) values
 ('e7200000-0000-0000-0000-000000000001','XG A'),('e7200000-0000-0000-0000-000000000002','XG B');
insert into public.gyms (id, name, brand_id, paid_until) values
 ('e7300000-0000-0000-0000-00000000000a','XG Gym A','e7200000-0000-0000-0000-000000000001', current_date + 300),
 ('e7300000-0000-0000-0000-00000000000b','XG Gym B','e7200000-0000-0000-0000-000000000002', current_date + 300);
insert into public.gym_members (gym_id, user_id, role) values
 ('e7300000-0000-0000-0000-00000000000a','e7000000-0000-0000-0000-00000000000a','owner'),
 ('e7300000-0000-0000-0000-00000000000a','e7000000-0000-0000-0000-00000000000d','supervisor'),
 ('e7300000-0000-0000-0000-00000000000a','e7000000-0000-0000-0000-00000000000c','trainer'),
 ('e7300000-0000-0000-0000-00000000000a','e7000000-0000-0000-0000-000000000012','member'),
 ('e7300000-0000-0000-0000-00000000000b','e7000000-0000-0000-0000-00000000000b','owner'),
 ('e7300000-0000-0000-0000-00000000000b','e7000000-0000-0000-0000-000000000011','owner');
insert into public.gym_invites (gym_id, email, role, invited_by) values
 ('e7300000-0000-0000-0000-00000000000b','9840066666@m.vinven.net','supervisor','e7000000-0000-0000-0000-00000000000b');
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'X1 Gym A''s supervisor invites Gym B''s co-owner by mobile as a member: refused, one role per person (expect They''re an owner at another gym, so they can only join as an owner., They aren''t at this gym)'
select pg_temp.as_user('e7000000-0000-0000-0000-00000000000d');
select result from public.whatsapp_invite('e7300000-0000-0000-0000-00000000000a', '', 'member', '9840077777');
select public.create_password_reset_code('e7300000-0000-0000-0000-00000000000a', 'e7000000-0000-0000-0000-000000000011');

\echo 'X2 A member only at Gym A still gets a code (expect t)'
select public.create_password_reset_code('e7300000-0000-0000-0000-00000000000a', 'e7000000-0000-0000-0000-000000000012') is not null;

\echo 'X3 Gym A''s trainer makes a code for a number with a Gym B invite (expect t: refused by accept-invite)'
select pg_temp.as_user('e7000000-0000-0000-0000-00000000000c');
select code is not null from public.whatsapp_invite('e7300000-0000-0000-0000-00000000000a', '', 'member', '9840066666');
reset role;
select public.invite_code_conflict((select code from public.gym_invites
  where gym_id = 'e7300000-0000-0000-0000-00000000000a' and email = '9840066666@m.vinven.net'));

\echo 'X4 A number tied to one gym only has no conflict (expect f)'
set role authenticated;
select pg_temp.as_user('e7000000-0000-0000-0000-00000000000c');
select code is not null from public.whatsapp_invite('e7300000-0000-0000-0000-00000000000a', '', 'member', '9840055555');
reset role;
select public.invite_code_conflict((select code from public.gym_invites
  where gym_id = 'e7300000-0000-0000-0000-00000000000a' and email = '9840055555@m.vinven.net'));

\echo 'X5 The app can''t look up conflicts (expect permission denied)'
set role authenticated;
select public.invite_code_conflict('AAAAAAAA');

\echo 'X6 An owner can''t insert someone into gym_members (expect permission denied)'
select pg_temp.as_user('e7000000-0000-0000-0000-00000000000a');
insert into public.gym_members (gym_id, user_id, role)
  values ('e7300000-0000-0000-0000-00000000000a','e7000000-0000-0000-0000-000000000099','supervisor');

\echo 'X7 Nor change a role directly (expect A role can''t be changed once it''s given)'
update public.gym_members set role = 'supervisor'
  where gym_id = 'e7300000-0000-0000-0000-00000000000a' and user_id = 'e7000000-0000-0000-0000-000000000012';

\echo 'X8 But can still suspend and remove (expect UPDATE 1, DELETE 1)'
update public.gym_members set status = 'suspended'
  where gym_id = 'e7300000-0000-0000-0000-00000000000a' and user_id = 'e7000000-0000-0000-0000-000000000012';
delete from public.gym_members
  where gym_id = 'e7300000-0000-0000-0000-00000000000a' and user_id = 'e7000000-0000-0000-0000-000000000012';

\echo 'X9 A supervisor can''t suspend anyone (expect UPDATE 0)'
select pg_temp.as_user('e7000000-0000-0000-0000-00000000000d');
update public.gym_members set status = 'suspended'
  where gym_id = 'e7300000-0000-0000-0000-00000000000a' and user_id = 'e7000000-0000-0000-0000-00000000000c';
reset role;
rollback;
