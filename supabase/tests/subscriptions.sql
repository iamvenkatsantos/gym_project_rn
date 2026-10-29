-- Owners paying CoreFit Gym: the yearly bill, starting a payment, completing it and
-- the admin recording one by hand. Self-contained: run after the migrations.
-- Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, raw_user_meta_data) values
 ('d0000000-0000-0000-0000-00000000000a','{"full_name":"Olga Owner"}'),
 ('d0000000-0000-0000-0000-00000000000b','{"full_name":"Ari Admin"}'),
 ('d0000000-0000-0000-0000-00000000000c','{"full_name":"Mani Member"}'),
 ('d0000000-0000-0000-0000-00000000000d','{"full_name":"Sara Supervisor"}'),
 ('d0000000-0000-0000-0000-00000000000e','{"full_name":"Oscar Other Owner"}');
insert into public.brands (id, name) values
 ('d3000000-0000-0000-0000-000000000001','Sub Gym'),
 ('d3000000-0000-0000-0000-000000000002','Other Sub Gym');
insert into public.gyms (id, name, brand_id) values
 ('d1000000-0000-0000-0000-000000000001','Sub Gym','d3000000-0000-0000-0000-000000000001'),
 ('d1000000-0000-0000-0000-000000000002','Other Sub Gym','d3000000-0000-0000-0000-000000000002');
insert into public.gym_members (gym_id, user_id, role) values
 ('d1000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000a','owner'),
 ('d1000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000c','member'),
 ('d1000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000d','supervisor'),
 ('d1000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-00000000000e','owner');
insert into public.platform_admins (user_id) values ('d0000000-0000-0000-0000-00000000000b');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'S1 The default is ₹4,999 a year and the cut is 0.5% (expect 499900 600000 50)'
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000b');
select branch_fee_cents, online_addon_cents, online_cut_bps from public.platform_settings;

\echo 'S2 The owner sees the yearly bill, never paid (expect 499900 0 499900 INR null)'
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000a');
select fee_cents, addon_cents, amount_cents, currency, paid_until
from public.branch_subscription('d1000000-0000-0000-0000-000000000001');

\echo 'S3 A member, the supervisor and another owner can''t see it (expect Only the owner x3)'
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000c');
select * from public.branch_subscription('d1000000-0000-0000-0000-000000000001');
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
select * from public.branch_subscription('d1000000-0000-0000-0000-000000000001');
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000e');
select * from public.branch_subscription('d1000000-0000-0000-0000-000000000001');

\echo 'S4 Only the owner starts a payment (expect Only the owner pays x2)'
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
select public.start_subscription_payment('d1000000-0000-0000-0000-000000000001');
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000e');
select public.start_subscription_payment('d1000000-0000-0000-0000-000000000001');

\echo 'S5 The owner starts one for the yearly bill (expect t, 499900 created)'
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000a');
select public.start_subscription_payment('d1000000-0000-0000-0000-000000000001') is not null as started;
select amount_cents, status from public.subscription_payments;

\echo 'S6 The owner can''t mark it paid (expect permission denied twice)'
update public.subscription_payments set status = 'paid' where gym_id = 'd1000000-0000-0000-0000-000000000001';
select public.complete_subscription_payment((select id from public.subscription_payments limit 1), 'pay_x', 499900, 0);

\echo 'S7 The supervisor and the other owner don''t see it (expect 0, 0)'
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
select count(*) from public.subscription_payments;
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000e');
select count(*) from public.subscription_payments;

reset role;

\echo 'S8 A wrong amount is refused (expect Paid 100 but the payment was for 499900)'
select public.complete_subscription_payment((select id from public.subscription_payments limit 1), 'pay_x', 100, 0);

\echo 'S9 The webhook completes it: a year from today (expect t, paid t t)'
select public.complete_subscription_payment((select id from public.subscription_payments limit 1), 'pay_SUB1', 499900, 11798)
  = (current_date + interval '1 year')::date - 1 as paid_a_year;
select status, period_start = current_date as starts_today,
       paid_until = (current_date + interval '1 year')::date - 1 as gym_paid_until
from public.subscription_payments s join public.gyms g on g.id = s.gym_id;

\echo 'S10 Completing it again changes nothing (expect t, 1 paid row)'
select public.complete_subscription_payment((select id from public.subscription_payments limit 1), 'pay_SUB1', 499900, 11798)
  = (current_date + interval '1 year')::date - 1 as same;
select count(*) from public.subscription_payments where status = 'paid';

\echo 'S11 The owner got a notice (expect 1)'
select count(*) from public.notifications
where recipient_id = 'd0000000-0000-0000-0000-00000000000a' and title = 'CoreFit Gym plan renewed';

set role authenticated;

\echo 'S12 Paid a year ahead, the owner can''t pay again yet (expect Already paid until)'
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000a');
select public.start_subscription_payment('d1000000-0000-0000-0000-000000000001');

\echo 'S13 The owner can''t record a payment by hand (expect Only CoreFit Gym admins)'
select public.admin_record_subscription('d1000000-0000-0000-0000-000000000002', 0, 'free');

\echo 'S14 The admin gives the other branch a free year (expect t, manual 0 paid)'
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000b');
select public.admin_record_subscription('d1000000-0000-0000-0000-000000000002', 0, ' Launch offer ')
  = (current_date + interval '1 year')::date - 1 as free_year;
select method, amount_cents, status, note from public.subscription_payments
where gym_id = 'd1000000-0000-0000-0000-000000000002';

\echo 'S15 A second year by hand runs on from the first (expect t)'
select public.admin_record_subscription('d1000000-0000-0000-0000-000000000002', 499900, 'Cash')
  = (current_date + interval '2 years')::date - 1 as two_years;

\echo 'S16 The admin sees paid_until on every branch (expect 2 rows, both t)'
select gym_name, paid_until > current_date as paid from public.admin_branches()
where gym_id in ('d1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000002');

\echo 'S17 With online payments on, the bill adds the add-on (expect 499900 600000 1099900)'
select public.admin_set_online_payments('d1000000-0000-0000-0000-000000000002', true, null);
select fee_cents, addon_cents, amount_cents
from public.branch_subscription('d1000000-0000-0000-0000-000000000002');

\echo 'S18 A branch on a free (0) fee has nothing to pay (expect Nothing to pay)'
select public.admin_set_online_payments('d1000000-0000-0000-0000-000000000002', false, null);
select public.admin_set_gym_fee('d1000000-0000-0000-0000-000000000002', 0);
reset role;
update public.gyms set paid_until = null where id = 'd1000000-0000-0000-0000-000000000002';
set role authenticated;
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000e');
select public.start_subscription_payment('d1000000-0000-0000-0000-000000000002');

\echo 'S19 Owners can''t read paid_until off the gym row (expect permission denied)'
select paid_until from public.gyms where id = 'd1000000-0000-0000-0000-000000000002';

reset role;

-- Unpaid branches can't add people. Set up as nobody, like the SQL editor.
select set_config('request.jwt.claim.sub', '', false);
insert into auth.users (id, raw_user_meta_data) values
 ('d0000000-0000-0000-0000-00000000000f','{"full_name":"Tara Trainer"}');
update auth.users set email = 'mani@example.com' where id = 'd0000000-0000-0000-0000-00000000000c';
insert into public.gyms (id, name, brand_id) values
 ('d1000000-0000-0000-0000-000000000003','Unpaid Gym','d3000000-0000-0000-0000-000000000002');
insert into public.gym_members (gym_id, user_id, role) values
 ('d1000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-00000000000e','owner'),
 ('d1000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-00000000000f','trainer');
set role authenticated;

\echo 'S20 A new branch isn''t paid (expect f)'
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000e');
select public.branch_is_paid('d1000000-0000-0000-0000-000000000003');

\echo 'S21 Its owner and trainer can''t invite, by email or WhatsApp (expect CoreFit Gym plan not paid x3)'
select public.invite_to_gym('d1000000-0000-0000-0000-000000000003', 'new.member@example.com', 'member');
select * from public.whatsapp_invite('d1000000-0000-0000-0000-000000000003', 'new.member@example.com', 'member', '9840011111');
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000f');
select public.invite_to_gym('d1000000-0000-0000-0000-000000000003', 'new.member@example.com', 'member');

\echo 'S22 Its owner can''t import members either (expect CoreFit Gym plan not paid)'
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000e');
select public.import_members('d1000000-0000-0000-0000-000000000003', '[{"email":"mani@example.com","name":"Mani","phone":"9840011111"}]'::jsonb);

\echo 'S23 The admin gives it no fee: now it counts as paid and invites work (expect t, invited)'
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000b');
select public.admin_set_gym_fee('d1000000-0000-0000-0000-000000000003', 0);
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000e');
select public.branch_is_paid('d1000000-0000-0000-0000-000000000003');
select public.invite_to_gym('d1000000-0000-0000-0000-000000000003', 'new.member@example.com', 'member');

reset role;

-- The 5-day grace before the app locks. Set up as nobody.
select set_config('request.jwt.claim.sub', '', false);
update public.gyms set fee_cents = null, paid_until = current_date - 3
where id = 'd1000000-0000-0000-0000-000000000003';
set role authenticated;

\echo 'S24 Ended 3 days ago: the trainer sees it unpaid, locking in 3 days (expect f t f)'
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000f');
select paid, locks_on = current_date + 3 as locks_in_3, locked
from public.branch_access('d1000000-0000-0000-0000-000000000003');

\echo 'S25 Someone from another branch can''t read it (expect Only people at this branch)'
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
select * from public.branch_access('d1000000-0000-0000-0000-000000000003');

reset role;
update public.gyms set paid_until = current_date - 6 where id = 'd1000000-0000-0000-0000-000000000003';
set role authenticated;

\echo 'S26 Ended 6 days ago: locked (expect f t)'
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000f');
select paid, locked from public.branch_access('d1000000-0000-0000-0000-000000000003');

\echo 'S27 A paid branch is open (expect t null f)'
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000a');
select paid, locks_on, locked from public.branch_access('d1000000-0000-0000-0000-000000000001');

reset role;
