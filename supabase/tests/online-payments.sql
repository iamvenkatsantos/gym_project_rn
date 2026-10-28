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

-- More members and plans for the cases below (as the database owner).
insert into auth.users (id, raw_user_meta_data) values
 ('f0000000-0000-0000-0000-000000000010','{"full_name":"Neha New"}'),
 ('f0000000-0000-0000-0000-000000000011','{"full_name":"Ravi Lapsed"}'),
 ('f0000000-0000-0000-0000-000000000012','{"full_name":"Lata Left"}'),
 ('f0000000-0000-0000-0000-000000000013','{"full_name":"Tanu Tapper"}');
insert into public.gym_members (gym_id, user_id, role, status) values
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000010','member','active'),
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000011','member','active'),
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000012','member','suspended'),
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000013','member','active');
insert into public.membership_plans (id, gym_id, name, price_cents, duration_days) values
 ('f2000000-0000-0000-0000-000000000002','f1000000-0000-0000-0000-000000000001','Free trial',0,7),
 ('f2000000-0000-0000-0000-000000000003','f1000000-0000-0000-0000-000000000001','Quarterly',400000,90);
-- Ravi's membership ended two months ago.
insert into public.memberships (member_id, plan_id, starts_on, ends_on, amount_paid_cents, payment_method)
values ('f0000000-0000-0000-0000-000000000011','f2000000-0000-0000-0000-000000000001',
        current_date - 90, current_date - 60, 150000, 'cash');

set role authenticated;

\echo 'P13 A free plan can''t be paid online (expect This plan is free)'
select pg_temp.as_user('f0000000-0000-0000-0000-000000000010');
select public.start_online_payment('f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000002');

\echo 'P14 A member who left the gym can''t pay (expect Only members of this gym)'
select pg_temp.as_user('f0000000-0000-0000-0000-000000000012');
select public.start_online_payment('f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001');

\echo 'P15 Neha and Ravi start payments; Ravi''s plan is then taken off sale (expect t, t)'
select pg_temp.as_user('f0000000-0000-0000-0000-000000000010');
select public.start_online_payment('f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000003') is not null as neha;
select pg_temp.as_user('f0000000-0000-0000-0000-000000000011');
select public.start_online_payment('f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000003') is not null as ravi;

\echo 'P16 Ten attempts in an hour, then no more (expect 10, then Too many payment attempts)'
select pg_temp.as_user('f0000000-0000-0000-0000-000000000013');
select count(public.start_online_payment('f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001'))
from generate_series(1, 10);
select public.start_online_payment('f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001');

reset role;
update public.membership_plans set active = false where id = 'f2000000-0000-0000-0000-000000000003';

\echo 'P17 Neha had no membership: hers starts today and runs 90 days (expect t t)'
select public.complete_online_payment(
  (select id from public.online_payments where member_id = 'f0000000-0000-0000-0000-000000000010'),
  'pay_NEHA', 400000, 9440) is not null as recorded;
select m.starts_on = current_date as starts_today, m.ends_on = current_date + 89 as ends_right
from public.memberships m where m.member_id = 'f0000000-0000-0000-0000-000000000010';

\echo 'P18 Ravi''s lapsed membership: the new one starts today, not after the old end (expect t)'
-- The link expired (webhook) but Razorpay still took his money: it must still count.
update public.online_payments set status = 'expired' where member_id = 'f0000000-0000-0000-0000-000000000011';
select public.complete_online_payment(
  (select id from public.online_payments where member_id = 'f0000000-0000-0000-0000-000000000011'),
  'pay_RAVI', 400000, 9440) is not null as recorded;
select m.starts_on = current_date as starts_today
from public.memberships m
where m.member_id = 'f0000000-0000-0000-0000-000000000011' and m.payment_method = 'online';

\echo 'P19 Meena pays again: it stacks after her last online one (expect t)'
insert into public.online_payments (gym_id, member_id, plan_id, amount_cents, currency) values
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000c','f2000000-0000-0000-0000-000000000001',150000,'INR');
select public.complete_online_payment(
  (select id from public.online_payments where member_id = 'f0000000-0000-0000-0000-00000000000c' and status = 'created'),
  'pay_MEENA2', 150000, 3540) is not null as recorded;
select max(starts_on) = current_date + 41 as stacked
from public.memberships where member_id = 'f0000000-0000-0000-0000-00000000000c';

\echo 'P20 The same Razorpay payment can''t be used for a second payment (expect duplicate key)'
insert into public.online_payments (gym_id, member_id, plan_id, amount_cents, currency) values
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000013','f2000000-0000-0000-0000-000000000001',150000,'INR');
select public.complete_online_payment(
  (select id from public.online_payments
   where member_id = 'f0000000-0000-0000-0000-000000000013' order by created_at desc limit 1),
  'pay_NEHA', 150000, 3540);

\echo 'P21 Online payments show in the payments export with method online (expect 4)'
select count(*) from public.memberships m
join public.membership_plans mp on mp.id = m.plan_id
where mp.gym_id = 'f1000000-0000-0000-0000-000000000001' and m.payment_method = 'online';

set role authenticated;

\echo 'P22 The admin switches it off; nobody can start a payment (expect f, then doesn''t take online payments)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000b');
select public.admin_set_online_payments('f1000000-0000-0000-0000-000000000001', false, 'acc_TestOwner01');
select online_payments from public.admin_branches() where gym_id = 'f1000000-0000-0000-0000-000000000001';
select pg_temp.as_user('f0000000-0000-0000-0000-000000000010');
select public.start_online_payment('f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001');

\echo 'P23 Members see only their own online payments (expect 1 for Neha)'
select count(*) from public.online_payments;

reset role;

\echo 'P24 Fees on the member by default; the owner can''t change it, the admin can (expect t, Only CoreFit Gym admins, f)'
set role authenticated;
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000b');
select online_fees_on_member from public.admin_branches() where gym_id = 'f1000000-0000-0000-0000-000000000001';
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000a');
select public.admin_set_online_fees_on_member('f1000000-0000-0000-0000-000000000001', false);
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000b');
select public.admin_set_online_fees_on_member('f1000000-0000-0000-0000-000000000001', false);
select online_fees_on_member from public.admin_branches() where gym_id = 'f1000000-0000-0000-0000-000000000001';
select public.admin_set_online_fees_on_member('f1000000-0000-0000-0000-000000000001', true);
reset role;

\echo 'P25 A grossed-up payment records the plan price on the membership (expect 102720 paid, membership 100000, notice says ₹1000)'
insert into public.membership_plans (id, gym_id, name, price_cents, duration_days) values
 ('f2000000-0000-0000-0000-000000000009','f1000000-0000-0000-0000-000000000001','Thousand',100000,30);
insert into public.online_payments (gym_id, member_id, plan_id, amount_cents, base_cents, charges_cents, currency) values
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000013','f2000000-0000-0000-0000-000000000009',102720,100000,2720,'INR');
select public.complete_online_payment(
  (select id from public.online_payments where plan_id = 'f2000000-0000-0000-0000-000000000009'),
  'pay_GROSS', 102720, 2425) is not null as recorded;
select op.amount_cents, m.amount_paid_cents
from public.online_payments op join public.memberships m on m.id = op.membership_id
where op.plan_id = 'f2000000-0000-0000-0000-000000000009';
select body from public.notifications where dedupe_key = 'online-payment:' ||
  (select id from public.online_payments where plan_id = 'f2000000-0000-0000-0000-000000000009') limit 1;
