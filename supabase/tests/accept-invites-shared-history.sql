-- Accepting gym invites and sharing history across gyms (#116). Self-contained: run
-- after the migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
\set ON_ERROR_ROLLBACK on
begin;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('e8000000-0000-0000-0000-00000000000a','ownera@sh.test',now(),'{"full_name":"Owner A"}'),
 ('e8000000-0000-0000-0000-00000000000b','ownerb@sh.test',now(),'{"full_name":"Owner B"}'),
 ('e8000000-0000-0000-0000-00000000000c','coachb@sh.test',now(),'{"full_name":"Coach B"}'),
 ('e8000000-0000-0000-0000-00000000000d','coachb2@sh.test',now(),'{"full_name":"Coach B2"}'),
 ('e8000000-0000-0000-0000-000000000011','mover@sh.test',now(),'{"full_name":"Mira Mover"}'),
 ('e8000000-0000-0000-0000-000000000012','stay@sh.test',now(),'{"full_name":"Sam Stay"}');
insert into public.brands (id, name) values
 ('e8200000-0000-0000-0000-000000000001','SH A'),('e8200000-0000-0000-0000-000000000002','SH B');
insert into public.gyms (id, name, brand_id, paid_until) values
 ('e8300000-0000-0000-0000-00000000000a','SH Gym A','e8200000-0000-0000-0000-000000000001', current_date + 300),
 ('e8300000-0000-0000-0000-00000000000b','SH Gym B','e8200000-0000-0000-0000-000000000002', current_date + 300);
insert into public.gym_members (gym_id, user_id, role) values
 ('e8300000-0000-0000-0000-00000000000a','e8000000-0000-0000-0000-00000000000a','owner'),
 ('e8300000-0000-0000-0000-00000000000a','e8000000-0000-0000-0000-000000000011','member'),
 ('e8300000-0000-0000-0000-00000000000b','e8000000-0000-0000-0000-00000000000b','owner'),
 ('e8300000-0000-0000-0000-00000000000b','e8000000-0000-0000-0000-00000000000c','trainer'),
 ('e8300000-0000-0000-0000-00000000000b','e8000000-0000-0000-0000-00000000000d','trainer');
insert into public.workout_logs (gym_id, member_id, client_id, title, started_at, completed_at) values
 ('e8300000-0000-0000-0000-00000000000a','e8000000-0000-0000-0000-000000000011', gen_random_uuid(), 'Gym A legs', now() - interval '3 days 1 hour', now() - interval '3 days');
insert into public.body_measurements (gym_id, member_id, measured_on, weight_kg) values
 ('e8300000-0000-0000-0000-00000000000a','e8000000-0000-0000-0000-000000000011', current_date - 3, 70);
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'H1 Gym B''s trainer invites someone who already has an account: an invite, not a member (expect invited_in_app, 0)'
select pg_temp.as_user('e8000000-0000-0000-0000-00000000000c');
select public.invite_to_gym('e8300000-0000-0000-0000-00000000000b', 'mover@sh.test', 'member');
select count(*) from public.gym_members
  where gym_id = 'e8300000-0000-0000-0000-00000000000b' and user_id = 'e8000000-0000-0000-0000-000000000011';

\echo 'H2 She has a Gym invite in her inbox (expect invite | Gym invite)'
reset role;
select kind, title from public.notifications where recipient_id = 'e8000000-0000-0000-0000-000000000011';
set role authenticated;

\echo 'H3 She sees it; someone else doesn''t (expect SH Gym B | member | Coach B, then 0)'
select pg_temp.as_user('e8000000-0000-0000-0000-000000000011');
select gym_name, role, invited_by_name from public.my_gym_invites();
select pg_temp.as_user('e8000000-0000-0000-0000-000000000012');
select count(*) from public.my_gym_invites();

\echo 'H4 Nobody else can accept or decline it (expect This invite is no longer open three times)'
select public.accept_gym_invite((select id from public.gym_invites limit 1), true);
reset role;
select id as invite_id from public.gym_invites where email = 'mover@sh.test' \gset
set role authenticated;
select pg_temp.as_user('e8000000-0000-0000-0000-000000000012');
select public.accept_gym_invite(:'invite_id', true);
select public.decline_gym_invite(:'invite_id');

\echo 'H5 Before she joins, Gym B''s trainer sees none of her Gym A history (expect 0)'
select pg_temp.as_user('e8000000-0000-0000-0000-00000000000c');
select count(*) from public.workout_logs where member_id = 'e8000000-0000-0000-0000-000000000011';

\echo 'H6 She joins without sharing: mapped to the trainer who invited her, invite gone (expect the gym id, f, 1, 0)'
select pg_temp.as_user('e8000000-0000-0000-0000-000000000011');
select public.accept_gym_invite(:'invite_id', false) = 'e8300000-0000-0000-0000-00000000000b';
select history_shared from public.gym_members
  where gym_id = 'e8300000-0000-0000-0000-00000000000b' and user_id = 'e8000000-0000-0000-0000-000000000011';
reset role;
select count(*) from public.member_trainers
  where gym_id = 'e8300000-0000-0000-0000-00000000000b' and member_id = 'e8000000-0000-0000-0000-000000000011'
    and trainer_id = 'e8000000-0000-0000-0000-00000000000c';
select count(*) from public.gym_invites where email = 'mover@sh.test';
set role authenticated;

\echo 'H7 Not shared: Gym B''s trainer and owner still see none of Gym A (expect 0, 0)'
select pg_temp.as_user('e8000000-0000-0000-0000-00000000000c');
select count(*) from public.workout_logs where member_id = 'e8000000-0000-0000-0000-000000000011';
select pg_temp.as_user('e8000000-0000-0000-0000-00000000000b');
select count(*) from public.body_measurements where member_id = 'e8000000-0000-0000-0000-000000000011';

\echo 'H8 She sees her own history from both gyms, with gym names (expect 1, SH Gym A)'
select pg_temp.as_user('e8000000-0000-0000-0000-000000000011');
select count(*) from public.workout_logs where member_id = 'e8000000-0000-0000-0000-000000000011';
select gym_name from public.history_gyms('e8000000-0000-0000-0000-000000000011');

\echo 'H9 She turns sharing on: her trainer and Gym B''s owner see Gym A, an unmapped trainer doesn''t (expect 1, 1, SH Gym A, 0)'
select public.set_history_sharing('e8300000-0000-0000-0000-00000000000b', true);
select pg_temp.as_user('e8000000-0000-0000-0000-00000000000c');
select count(*) from public.workout_logs where member_id = 'e8000000-0000-0000-0000-000000000011';
select pg_temp.as_user('e8000000-0000-0000-0000-00000000000b');
select count(*) from public.body_measurements where member_id = 'e8000000-0000-0000-0000-000000000011';
select gym_name from public.history_gyms('e8000000-0000-0000-0000-000000000011');
select pg_temp.as_user('e8000000-0000-0000-0000-00000000000d');
select count(*) from public.workout_logs where member_id = 'e8000000-0000-0000-0000-000000000011';

\echo 'H10 Gym A''s owner gets nothing new from Gym B (expect 1: only the Gym A log)'
select pg_temp.as_user('e8000000-0000-0000-0000-00000000000a');
select count(*) from public.workout_logs where member_id = 'e8000000-0000-0000-0000-000000000011';

\echo 'H11 Only she can switch it, only for her own gyms (expect You aren''t at this gym)'
select pg_temp.as_user('e8000000-0000-0000-0000-00000000000b');
select public.set_history_sharing('e8300000-0000-0000-0000-00000000000a', true);

\echo 'H12 Nobody can set history_shared directly (expect permission denied)'
select pg_temp.as_user('e8000000-0000-0000-0000-000000000011');
update public.gym_members set history_shared = false
  where user_id = 'e8000000-0000-0000-0000-000000000011';

\echo 'H13 A platform admin still adds an existing account straight away (expect added)'
reset role;
insert into public.platform_admins (user_id) values ('e8000000-0000-0000-0000-00000000000b');
set role authenticated;
select pg_temp.as_user('e8000000-0000-0000-0000-00000000000b');
select public.invite_to_gym('e8300000-0000-0000-0000-00000000000a', 'stay@sh.test', 'member');
reset role;
rollback;
