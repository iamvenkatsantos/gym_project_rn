-- WhatsApp invite codes and who can get a trainer. Self-contained: run after
-- the migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('f8000000-0000-0000-0000-00000000000a','owner@ic.test',now(),'{"full_name":"Ivy Owner"}'),
 ('f8000000-0000-0000-0000-00000000000c','coach@ic.test',now(),'{"full_name":"Cy Coach"}'),
 ('f8000000-0000-0000-0000-00000000000d','done@ic.test',now(),'{"full_name":"Dee Done"}');
-- An imported member who hasn't signed up yet.
insert into auth.users (id, email, raw_user_meta_data) values
 ('f8000000-0000-0000-0000-000000000010','imp@ic.test','{"full_name":"Imran Imported"}');
insert into public.brands (id, name) values ('f9000000-0000-0000-0000-000000000001','IC Gym');
insert into public.gyms (id, name, brand_id) values
 ('fa000000-0000-0000-0000-000000000001','IC Gym Anna Nagar','f9000000-0000-0000-0000-000000000001');
insert into public.gym_members (gym_id, user_id, role) values
 ('fa000000-0000-0000-0000-000000000001','f8000000-0000-0000-0000-00000000000a','owner'),
 ('fa000000-0000-0000-0000-000000000001','f8000000-0000-0000-0000-00000000000c','trainer'),
 ('fa000000-0000-0000-0000-000000000001','f8000000-0000-0000-0000-00000000000d','member'),
 ('fa000000-0000-0000-0000-000000000001','f8000000-0000-0000-0000-000000000010','member');

-- Paid branches, so staff can add people (20261029010000_owner_subscriptions).
update public.gyms set paid_until = current_date + 365 where paid_until is null;
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;
select pg_temp.as_user('f8000000-0000-0000-0000-00000000000a');

\echo 'C1 A bad mobile is refused (expect Enter a valid mobile number)'
select * from public.whatsapp_invite('fa000000-0000-0000-0000-000000000001', 'new@ic.test', 'member', '12');

\echo 'C2 A new email gets an 8-character code (expect invited, t)'
select result, code ~ '^[A-HJ-NP-Z2-9]{8}$' as code_ok
from public.whatsapp_invite('fa000000-0000-0000-0000-000000000001', ' New@IC.test ', 'member', '+91 98400 12345');

\echo 'C3 The invite keeps the code, mobile and a 7-day expiry (expect +919840012345, t)'
select phone, code_expires_at between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour' as expiry_ok
from public.gym_invites where email = 'new@ic.test';

\echo 'C4 Someone already here gets no code (expect already_member, null code)'
select * from public.whatsapp_invite('fa000000-0000-0000-0000-000000000001', 'done@ic.test', 'member', '9840012345');

\echo 'C5 A trainer can''t invite a supervisor this way either (expect an error)'
select pg_temp.as_user('f8000000-0000-0000-0000-00000000000c');
select * from public.whatsapp_invite('fa000000-0000-0000-0000-000000000001', 'boss@ic.test', 'supervisor', '9840012345');
reset role;

-- Remember the code for the checks below.
select code as the_code from public.gym_invites where email = 'new@ic.test' \gset

\echo 'C6 Signed out, the code shows the gym, in any case and with a dash (expect IC Gym Anna Nagar, new@ic.test, member, twice)'
set role anon;
select * from public.invite_by_code(:'the_code');
select * from public.invite_by_code(lower(substr(:'the_code', 1, 4) || '-' || substr(:'the_code', 5)));

\echo 'C7 A wrong code shows nothing (expect 0 rows)'
select * from public.invite_by_code('ABCDEFGH');

\echo 'C8 Signed-out people can''t look up accounts or make codes (expect permission denied twice)'
select * from public.invite_code_account(:'the_code');
select public.new_invite_code();
reset role;

\echo 'C9 accept-invite sees no account yet (expect new@ic.test, +919840012345, no user, f)'
select * from public.invite_code_account(:'the_code');

\echo 'C10 An expired code shows nothing (expect 0 rows twice)'
update public.gym_invites set code_expires_at = now() - interval '1 minute' where email = 'new@ic.test';
select * from public.invite_by_code(:'the_code');
select * from public.invite_code_account(:'the_code');
update public.gym_invites set code_expires_at = now() + interval '7 days' where email = 'new@ic.test';

\echo 'C11 accept-invite makes the account confirmed; the invite is claimed and the code stops working (expect member active, 0 invites, 0 rows)'
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('f8000000-0000-0000-0000-000000000011','new@ic.test',now(),'{"full_name":"Nila New"}');
select role, status from public.gym_members where user_id = 'f8000000-0000-0000-0000-000000000011';
select count(*) from public.gym_invites where email = 'new@ic.test';
select * from public.invite_by_code(:'the_code');

\echo 'C12 People list says who has signed up (expect Cy t, Dee t, Imran f, Ivy t, Nila t)'
set role authenticated;
select pg_temp.as_user('f8000000-0000-0000-0000-00000000000a');
select full_name, signed_up from public.gym_people('fa000000-0000-0000-0000-000000000001');

\echo 'C13 No trainer before they sign up (expect They haven''t signed up yet. Add a trainer once they join.)'
insert into public.member_trainers (gym_id, member_id, trainer_id) values
 ('fa000000-0000-0000-0000-000000000001','f8000000-0000-0000-0000-000000000010','f8000000-0000-0000-0000-00000000000c');

\echo 'C14 A signed-up member gets one (expect INSERT 0 1)'
insert into public.member_trainers (gym_id, member_id, trainer_id) values
 ('fa000000-0000-0000-0000-000000000001','f8000000-0000-0000-0000-00000000000d','f8000000-0000-0000-0000-00000000000c');
reset role;

\echo 'C15 An imported member invited on WhatsApp: accept-invite finds their account (expect imp@ic.test, user f8..10, confirmed f)'
delete from public.gym_members where user_id = 'f8000000-0000-0000-0000-000000000010';
set role authenticated;
select pg_temp.as_user('f8000000-0000-0000-0000-00000000000a');
select result from public.whatsapp_invite('fa000000-0000-0000-0000-000000000001', 'imp@ic.test', 'member', '9840099999');
reset role;
select i.email, a.user_id, a.confirmed
from public.gym_invites i, public.invite_code_account(i.code) a
where i.email = 'imp@ic.test';
