-- Moving between gyms and one role per person (2026-11-11). Self-contained: run after the
-- migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
\set ON_ERROR_ROLLBACK on
begin;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('e9000000-0000-0000-0000-00000000000a','ownera@mv.test',now(),'{"full_name":"Owner A"}'),
 ('e9000000-0000-0000-0000-00000000000b','ownerb@mv.test',now(),'{"full_name":"Owner B"}'),
 ('e9000000-0000-0000-0000-00000000000c','coacha@mv.test',now(),'{"full_name":"Coach A"}'),
 ('e9000000-0000-0000-0000-000000000011','mover@mv.test',now(),'{"full_name":"Mira Mover"}');
insert into public.brands (id, name) values
 ('e9200000-0000-0000-0000-000000000001','MV A'),('e9200000-0000-0000-0000-000000000002','MV B');
insert into public.gyms (id, name, brand_id, paid_until) values
 ('e9300000-0000-0000-0000-00000000000a','MV Gym A','e9200000-0000-0000-0000-000000000001', current_date + 300),
 ('e9300000-0000-0000-0000-00000000000b','MV Gym B','e9200000-0000-0000-0000-000000000002', current_date + 300);
insert into public.gym_members (gym_id, user_id, role) values
 ('e9300000-0000-0000-0000-00000000000a','e9000000-0000-0000-0000-00000000000a','owner'),
 ('e9300000-0000-0000-0000-00000000000a','e9000000-0000-0000-0000-00000000000c','trainer'),
 ('e9300000-0000-0000-0000-00000000000a','e9000000-0000-0000-0000-000000000011','member'),
 ('e9300000-0000-0000-0000-00000000000b','e9000000-0000-0000-0000-00000000000b','owner');
insert into public.member_trainers (gym_id, member_id, trainer_id) values
 ('e9300000-0000-0000-0000-00000000000a','e9000000-0000-0000-0000-000000000011','e9000000-0000-0000-0000-00000000000c');
insert into public.membership_plans (id, gym_id, name, price_cents, duration_days) values
 ('e9400000-0000-0000-0000-00000000000a','e9300000-0000-0000-0000-00000000000a','Monthly',100000,30),
 ('e9400000-0000-0000-0000-00000000000b','e9300000-0000-0000-0000-00000000000b','Monthly',100000,30);
insert into public.memberships (member_id, plan_id, starts_on, ends_on, amount_paid_cents, payment_method) values
 ('e9000000-0000-0000-0000-000000000011','e9400000-0000-0000-0000-00000000000a', public.gym_day('e9300000-0000-0000-0000-00000000000a') - 10, public.gym_day('e9300000-0000-0000-0000-00000000000a') + 19, 100000, 'cash');
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'M1 Gym B invites Gym A''s trainer as a member (expect They''re a trainer at another gym, so they can only join as a trainer.)'
select pg_temp.as_user('e9000000-0000-0000-0000-00000000000b');
select public.invite_to_gym('e9300000-0000-0000-0000-00000000000b', 'coacha@mv.test', 'member');

\echo 'M2 Gym B invites the member (expect invited_in_app)'
select public.invite_to_gym('e9300000-0000-0000-0000-00000000000b', 'mover@mv.test', 'member');

\echo 'M3 Her invite says what she leaves behind (expect MV Gym B | MV Gym A | 20)'
select pg_temp.as_user('e9000000-0000-0000-0000-000000000011');
select gym_name, leaving_gyms, days_left from public.my_gym_invites();

\echo 'M4 She joins Gym B (expect Gym B''s id)'
select public.accept_gym_invite((select id from public.my_gym_invites() limit 1), false);

\echo 'M5 Gym A: moved, 20 days left, membership ended yesterday, no trainer link, no current membership (expect moved | 20 | t | 0 | f)'
reset role;
select gm.status, gm.moved_days_left,
       (select max(m.ends_on) from public.memberships m where m.plan_id = 'e9400000-0000-0000-0000-00000000000a')
         = public.gym_day('e9300000-0000-0000-0000-00000000000a') - 1,
       (select count(*) from public.member_trainers where member_id = gm.user_id),
       public.has_current_membership(gm.gym_id, gm.user_id)
from public.gym_members gm
where gm.gym_id = 'e9300000-0000-0000-0000-00000000000a' and gm.user_id = 'e9000000-0000-0000-0000-000000000011';
set role authenticated;

\echo 'M6 Her profile now has only Gym B active (expect MV Gym B)'
select g.name from public.gym_members gm join public.gyms g on g.id = gm.gym_id
where gm.user_id = 'e9000000-0000-0000-0000-000000000011' and gm.status = 'active';

\echo 'M7 Gym A''s owner: not on People, listed as moved (expect 0, then Mira Mover | 20)'
select pg_temp.as_user('e9000000-0000-0000-0000-00000000000a');
select count(*) from public.gym_people('e9300000-0000-0000-0000-00000000000a') where user_id = 'e9000000-0000-0000-0000-000000000011';
select full_name, days_left from public.gym_moved_members('e9300000-0000-0000-0000-00000000000a');

\echo 'M8 Gym B''s owner can''t see Gym A''s moved list (expect 0)'
select pg_temp.as_user('e9000000-0000-0000-0000-00000000000b');
select count(*) from public.gym_moved_members('e9300000-0000-0000-0000-00000000000a');

\echo 'M9 Gym A''s owner can''t reactivate her (expect They moved to another gym. Invite them again to bring them back.)'
select pg_temp.as_user('e9000000-0000-0000-0000-00000000000a');
update public.gym_members set status = 'active'
where gym_id = 'e9300000-0000-0000-0000-00000000000a' and user_id = 'e9000000-0000-0000-0000-000000000011';

\echo 'M10 Or record a membership for her (expect They moved to another gym. Invite them again first.)'
insert into public.memberships (member_id, plan_id, starts_on, ends_on)
values ('e9000000-0000-0000-0000-000000000011','e9400000-0000-0000-0000-00000000000a', current_date, current_date + 29);

\echo 'M11 Gym A invites her back; she comes back and leaves Gym B (expect invited_in_app, Gym A''s id)'
select public.invite_to_gym('e9300000-0000-0000-0000-00000000000a', 'mover@mv.test', 'member');
select pg_temp.as_user('e9000000-0000-0000-0000-000000000011');
select public.accept_gym_invite((select id from public.my_gym_invites() limit 1), false);

\echo 'M12 Active at A again without her old membership, moved at B (expect active | f, moved)'
reset role;
select status, public.has_current_membership(gym_id, user_id) from public.gym_members
where gym_id = 'e9300000-0000-0000-0000-00000000000a' and user_id = 'e9000000-0000-0000-0000-000000000011';
select status from public.gym_members
where gym_id = 'e9300000-0000-0000-0000-00000000000b' and user_id = 'e9000000-0000-0000-0000-000000000011';
set role authenticated;

\echo 'M13 Gym B invites Gym A''s trainer as a trainer; joining moves him out of A (expect invited_in_app, Gym B''s id, moved | 0)'
select pg_temp.as_user('e9000000-0000-0000-0000-00000000000b');
select public.invite_to_gym('e9300000-0000-0000-0000-00000000000b', 'coacha@mv.test', 'trainer');
select pg_temp.as_user('e9000000-0000-0000-0000-00000000000c');
select public.accept_gym_invite((select id from public.my_gym_invites() limit 1), false);
reset role;
select gm.status, (select count(*) from public.member_trainers where trainer_id = gm.user_id)
from public.gym_members gm
where gm.gym_id = 'e9300000-0000-0000-0000-00000000000a' and gm.user_id = 'e9000000-0000-0000-0000-00000000000c';

\echo 'M14 An owner who joins another gym as an owner stays at their own (expect Gym B''s id, active)'
insert into public.gym_invites (gym_id, email, role, invited_by)
values ('e9300000-0000-0000-0000-00000000000b','ownera@mv.test','owner','e9000000-0000-0000-0000-00000000000b');
set role authenticated;
select pg_temp.as_user('e9000000-0000-0000-0000-00000000000a');
select public.accept_gym_invite((select id from public.my_gym_invites() limit 1), false);
reset role;
select status from public.gym_members
where gym_id = 'e9300000-0000-0000-0000-00000000000a' and user_id = 'e9000000-0000-0000-0000-00000000000a';

\echo 'M15 The internal function is closed (expect permission denied)'
set role authenticated;
select public.move_out('e9000000-0000-0000-0000-000000000011', 'e9300000-0000-0000-0000-00000000000b');
reset role;
rollback;
