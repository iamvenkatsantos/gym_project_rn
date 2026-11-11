-- Resending pending invites (Venkat, 2026-11-11). Self-contained: run after the
-- migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
\set ON_ERROR_ROLLBACK on
begin;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('e9000000-0000-0000-0000-00000000000a','owner@ri.test',now(),'{"full_name":"Owner"}'),
 ('e9000000-0000-0000-0000-00000000000b','super@ri.test',now(),'{"full_name":"Super"}'),
 ('e9000000-0000-0000-0000-00000000000c','coach@ri.test',now(),'{"full_name":"Coach"}'),
 ('e9000000-0000-0000-0000-00000000000d','coach2@ri.test',now(),'{"full_name":"Coach Two"}'),
 ('e9000000-0000-0000-0000-00000000000e','admin@ri.test',now(),'{"full_name":"Admin"}'),
 ('e9000000-0000-0000-0000-00000000000f','outsider@ri.test',now(),'{"full_name":"Outsider"}'),
 ('e9000000-0000-0000-0000-000000000010','late@ri.test',now(),'{"full_name":"Late Signup"}');
insert into auth.users (id, email) values
 ('e9000000-0000-0000-0000-000000000011','pending@ri.test');
insert into public.platform_admins (user_id) values ('e9000000-0000-0000-0000-00000000000e');
insert into public.brands (id, name) values ('e9200000-0000-0000-0000-000000000001','RI');
insert into public.gyms (id, name, brand_id, paid_until) values
 ('e9300000-0000-0000-0000-00000000000a','RI Gym','e9200000-0000-0000-0000-000000000001', current_date + 300),
 ('e9300000-0000-0000-0000-00000000000b','RI New','e9200000-0000-0000-0000-000000000001', current_date + 300);
insert into public.gym_members (gym_id, user_id, role) values
 ('e9300000-0000-0000-0000-00000000000a','e9000000-0000-0000-0000-00000000000a','owner'),
 ('e9300000-0000-0000-0000-00000000000a','e9000000-0000-0000-0000-00000000000b','supervisor'),
 ('e9300000-0000-0000-0000-00000000000a','e9000000-0000-0000-0000-00000000000c','trainer'),
 ('e9300000-0000-0000-0000-00000000000a','e9000000-0000-0000-0000-00000000000d','trainer');
insert into public.gym_invites (id, gym_id, email, role, invited_by) values
 ('e9400000-0000-0000-0000-000000000001','e9300000-0000-0000-0000-00000000000a','pending@ri.test','member','e9000000-0000-0000-0000-00000000000c'),
 ('e9400000-0000-0000-0000-000000000002','e9300000-0000-0000-0000-00000000000a','newtrainer@ri.test','trainer','e9000000-0000-0000-0000-00000000000a'),
 ('e9400000-0000-0000-0000-000000000003','e9300000-0000-0000-0000-00000000000b','newowner@ri.test','owner','e9000000-0000-0000-0000-00000000000e'),
 ('e9400000-0000-0000-0000-000000000004','e9300000-0000-0000-0000-00000000000a','9840012345@m.vinven.net','member','e9000000-0000-0000-0000-00000000000a'),
 ('e9400000-0000-0000-0000-000000000005','e9300000-0000-0000-0000-00000000000a','late@ri.test','member','e9000000-0000-0000-0000-00000000000a');
update public.gym_invites set code = 'AAAABBBB', code_expires_at = now() - interval '1 day', phone = '9840012345'
  where id = 'e9400000-0000-0000-0000-000000000004';
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'R1 The trainer who sent it resends by email; who invited them stays (expect invited | member, then the coach)'
select pg_temp.as_user('e9000000-0000-0000-0000-00000000000c');
select result, email_role from public.resend_gym_invite('e9400000-0000-0000-0000-000000000001', 'email');
reset role;
select invited_by = 'e9000000-0000-0000-0000-00000000000c' as kept from public.gym_invites where id = 'e9400000-0000-0000-0000-000000000001';
set role authenticated;

\echo 'R2 Another trainer can''t, nor a trainer on a trainer invite, nor an outsider (expect You can''t resend this invite x3)'
select pg_temp.as_user('e9000000-0000-0000-0000-00000000000d');
select result from public.resend_gym_invite('e9400000-0000-0000-0000-000000000001', 'email');
select pg_temp.as_user('e9000000-0000-0000-0000-00000000000c');
select result from public.resend_gym_invite('e9400000-0000-0000-0000-000000000002', 'email');
select pg_temp.as_user('e9000000-0000-0000-0000-00000000000f');
select result from public.resend_gym_invite('e9400000-0000-0000-0000-000000000001', 'email');

\echo 'R3 The supervisor resends the trainer invite; the owner can''t resend an owner invite (expect invited | trainer, then error)'
select pg_temp.as_user('e9000000-0000-0000-0000-00000000000b');
select result, email_role from public.resend_gym_invite('e9400000-0000-0000-0000-000000000002', 'email');
select pg_temp.as_user('e9000000-0000-0000-0000-00000000000a');
select result from public.resend_gym_invite('e9400000-0000-0000-0000-000000000003', 'email');

\echo 'R4 The admin sees and resends a new gym''s owner invite as Gym owner (expect 1, invited | gym_owner)'
select pg_temp.as_user('e9000000-0000-0000-0000-00000000000e');
select count(*) from public.gym_invites where gym_id = 'e9300000-0000-0000-0000-00000000000b';
select result, email_role from public.resend_gym_invite('e9400000-0000-0000-0000-000000000003', 'email');

\echo 'R5 A mobile login can''t be emailed; on WhatsApp its expired code is renewed (expect error, then t | t | t)'
select pg_temp.as_user('e9000000-0000-0000-0000-00000000000a');
select result from public.resend_gym_invite('e9400000-0000-0000-0000-000000000004', 'email');
select code <> 'AAAABBBB' as new_code, code_expires_at > now() + interval '6 days' as week, result = 'invited' as ok
  from public.resend_gym_invite('e9400000-0000-0000-0000-000000000004', 'whatsapp');
reset role;
select code_expires_at > now() as saved from public.gym_invites where id = 'e9400000-0000-0000-0000-000000000004';
set role authenticated;

\echo 'R6 A code still in date is kept (expect t)'
select code = (select i.code from public.gym_invites i where i.id = 'e9400000-0000-0000-0000-000000000004') as same
  from public.resend_gym_invite('e9400000-0000-0000-0000-000000000004', 'whatsapp');

\echo 'R7 They made an account since: the inbox invite goes instead (expect invited_in_app, 1)'
select result from public.resend_gym_invite('e9400000-0000-0000-0000-000000000005', 'email');
reset role;
select count(*) from public.notifications where recipient_id = 'e9000000-0000-0000-0000-000000000010' and kind = 'invite';

\echo 'R8 Already at the gym: the leftover invite is removed (expect already_member, 0)'
insert into public.gym_members (gym_id, user_id, role) values
 ('e9300000-0000-0000-0000-00000000000a','e9000000-0000-0000-0000-000000000010','member');
set role authenticated;
select result from public.resend_gym_invite('e9400000-0000-0000-0000-000000000005', 'email');
reset role;
select count(*) from public.gym_invites where id = 'e9400000-0000-0000-0000-000000000005';

\echo 'R9 Email cap: free, then one a minute, then 5 a day (expect null, Sent just now..., Emailed 5 times...)'
select public.invite_email_wait('e9300000-0000-0000-0000-00000000000a', 'pending@ri.test') is null as free;
select public.record_invite_email('e9300000-0000-0000-0000-00000000000a', 'Pending@RI.test', null);
select public.invite_email_wait('e9300000-0000-0000-0000-00000000000a', 'pending@ri.test');
update public.gym_invites set email_tried_at = now() - interval '2 minutes', email_sends = 5
  where id = 'e9400000-0000-0000-0000-000000000001';
select public.invite_email_wait('e9300000-0000-0000-0000-00000000000a', 'pending@ri.test');

\echo 'R10 A failed send is recorded; the next day the count restarts (expect Too many | 1)'
update public.gym_invites set email_sends_on = current_date - 1 where id = 'e9400000-0000-0000-0000-000000000001';
select public.record_invite_email('e9300000-0000-0000-0000-00000000000a', 'pending@ri.test', 'Too many');
select email_error, email_sends from public.gym_invites where id = 'e9400000-0000-0000-0000-000000000001';

\echo 'R11 Only the service role uses the email helpers (expect permission denied x3)'
set role authenticated;
select public.invite_email_wait('e9300000-0000-0000-0000-00000000000a', 'pending@ri.test');
select public.record_invite_email('e9300000-0000-0000-0000-00000000000a', 'pending@ri.test', null);
select public.invite_account_id('pending@ri.test');
reset role;
\echo 'R12 The unconfirmed account is found for the email update (expect t)'
select public.invite_account_id('PENDING@ri.test') = 'e9000000-0000-0000-0000-000000000011';
rollback;
