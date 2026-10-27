-- Online payments: the admin switch, starting a payment and completing it. Self-contained:
-- run after the migrations (rls.sql is optional). Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, raw_user_meta_data) values
 ('f0000000-0000-0000-0000-00000000000a','{"full_name":"Priya Owner"}'),
 ('f0000000-0000-0000-0000-00000000000b','{"full_name":"Ajay Admin"}'),
 ('f0000000-0000-0000-0000-00000000000c','{"full_name":"Meena Member"}'),
 ('f0000000-0000-0000-0000-00000000000d','{"full_name":"Sid Supervisor"}'),
 ('f0000000-0000-0000-0000-00000000000e','{"full_name":"Omar Outsider"}');
insert into public.brands (id, name) values
 ('f3000000-0000-0000-0000-000000000001','Pay Gym'),
 ('f3000000-0000-0000-0000-000000000002','Other Pay Gym');
insert into public.gyms (id, name, brand_id) values
 ('f1000000-0000-0000-0000-000000000001','Pay Gym','f3000000-0000-0000-0000-000000000001'),
 ('f1000000-0000-0000-0000-000000000002','Other Pay Gym','f3000000-0000-0000-0000-000000000002');
insert into public.gym_members (gym_id, user_id, role) values
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000a','owner'),
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000c','member'),
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000d','supervisor'),
 ('f1000000-0000-0000-0000-000000000002','f0000000-0000-0000-0000-00000000000e','member');
insert into public.platform_admins (user_id) values ('f0000000-0000-0000-0000-00000000000b');
insert into public.membership_plans (id, gym_id, name, price_cents, duration_days) values
 ('f2000000-0000-0000-0000-000000000001','f1000000-0000-0000-0000-000000000001','Monthly',150000,30);
-- Meena's current membership runs to 10 days from now, so a renewal starts the day after.
insert into public.memberships (member_id, plan_id, starts_on, ends_on, amount_paid_cents, payment_method)
values ('f0000000-0000-0000-0000-00000000000c','f2000000-0000-0000-0000-000000000001',
        current_date - 19, current_date + 10, 150000, 'cash');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'P1 Meena can''t pay while the switch is off (expect doesn''t take online payments)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000c');
select public.start_online_payment('f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001');

\echo 'P2 The owner can''t switch it on (expect Only CoreFit Gym admins)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000a');
select public.admin_set_online_payments('f1000000-0000-0000-0000-000000000001', true, null);

\echo 'P3 The admin rejects a malformed account ID (expect Enter the linked account ID)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000b');
select public.admin_set_online_payments('f1000000-0000-0000-0000-000000000001', true, 'bank-123');

\echo 'P4 The admin switches it on with a linked account (expect t, acc_TestOwner01)'
select public.admin_set_online_payments('f1000000-0000-0000-0000-000000000001', true, ' acc_TestOwner01 ');
select online_payments, razorpay_account_id from public.admin_branches()
where gym_id = 'f1000000-0000-0000-0000-000000000001';

\echo 'P5 Meena reads the switch but not the linked account (expect t, then permission denied)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000c');
select online_payments from public.gyms where id = 'f1000000-0000-0000-0000-000000000001';
select razorpay_account_id from public.gyms where id = 'f1000000-0000-0000-0000-000000000001';

\echo 'P6 Omar from another gym can''t pay here (expect Only members of this gym)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000e');
select public.start_online_payment('f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001');

\echo 'P7 Meena starts a payment for the plan''s price (expect 150000 created)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000c');
select public.start_online_payment('f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001') is not null as started;
select amount_cents, status from public.online_payments;

\echo 'P8 Meena can''t mark it paid herself (expect permission denied twice)'
update public.online_payments set status = 'paid' where member_id = auth.uid();
select public.complete_online_payment((select id from public.online_payments limit 1), 'pay_x', 150000, 3540);

\echo 'P9 Sid the supervisor sees it; Omar doesn''t (expect 1, 0)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000d');
select count(*) from public.online_payments;
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000e');
select count(*) from public.online_payments;

reset role;

\echo 'P10 A wrong amount is refused (expect Paid 100 but the payment was for 150000)'
select public.complete_online_payment((select id from public.online_payments limit 1), 'pay_x', 100, 0);

\echo 'P11 The webhook completes it: renewal starts the day after the current one (expect t t online paid)'
select public.complete_online_payment((select id from public.online_payments limit 1), 'pay_TEST123', 150000, 3540) is not null as recorded;
select m.starts_on = current_date + 11 as starts_after, m.ends_on = current_date + 40 as ends_right,
       m.payment_method, op.status
from public.online_payments op join public.memberships m on m.id = op.membership_id;

\echo 'P12 Completing it again changes nothing (expect 2 memberships, 2 staff notified once)'
select public.complete_online_payment((select id from public.online_payments limit 1), 'pay_TEST123', 150000, 3540) is not null as same;
select count(*) from public.memberships where member_id = 'f0000000-0000-0000-0000-00000000000c';
select count(*) from public.notifications where dedupe_key like 'online-payment:%';
