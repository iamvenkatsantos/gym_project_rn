-- Membership offers: plan offers, the loyalty offer and saved offers. Self-contained:
-- run after the migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, raw_user_meta_data) values
 ('f0000000-0000-0000-0000-00000000000a','{"full_name":"Oviya Owner"}'),
 ('f0000000-0000-0000-0000-00000000000b','{"full_name":"Mani Member"}'),
 ('f0000000-0000-0000-0000-00000000000c','{"full_name":"Lata Loyal"}'),
 ('f0000000-0000-0000-0000-00000000000d','{"full_name":"Siva Supervisor"}'),
 ('f0000000-0000-0000-0000-00000000000e','{"full_name":"Gopi Gap"}');
insert into public.brands (id, name) values ('f3000000-0000-0000-0000-000000000001','Offer Gym');
insert into public.gyms (id, name, brand_id, online_payments, paid_until) values
 ('f1000000-0000-0000-0000-000000000001','Offer Gym','f3000000-0000-0000-0000-000000000001', true, current_date + 365);
insert into public.gym_members (gym_id, user_id, role) values
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000a','owner'),
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000b','member'),
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000c','member'),
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000d','supervisor'),
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000e','member');
insert into public.membership_plans (id, gym_id, name, price_cents, duration_days) values
 ('f2000000-0000-0000-0000-000000000001','f1000000-0000-0000-0000-000000000001','Monthly',120000,30),
 ('f2000000-0000-0000-0000-000000000002','f1000000-0000-0000-0000-000000000001','Quarterly',349900,90);
-- Lata paid two months back to back, ending in 5 days. Gopi paid two months with a 20-day break.
insert into public.memberships (member_id, plan_id, starts_on, ends_on, amount_paid_cents, payment_method) values
 ('f0000000-0000-0000-0000-00000000000c','f2000000-0000-0000-0000-000000000001', current_date - 55, current_date - 26, 120000, 'cash'),
 ('f0000000-0000-0000-0000-00000000000c','f2000000-0000-0000-0000-000000000001', current_date - 25, current_date + 4, 120000, 'upi'),
 ('f0000000-0000-0000-0000-00000000000e','f2000000-0000-0000-0000-000000000001', current_date - 75, current_date - 46, 120000, 'cash'),
 ('f0000000-0000-0000-0000-00000000000e','f2000000-0000-0000-0000-000000000001', current_date - 25, current_date + 4, 120000, 'cash');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'O1 No offers yet: Mani pays the price (expect 120000, null)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000b');
select * from public.my_plan_price('f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001');

\echo 'O2 Bad offers are refused (expect check violations: 95%, flat above price, no end date)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000a');
update public.membership_plans set offer_type = 'percent', offer_value = 95, offer_ends_on = current_date + 10
where id = 'f2000000-0000-0000-0000-000000000001';
update public.membership_plans set offer_type = 'flat', offer_value = 130000, offer_ends_on = current_date + 10
where id = 'f2000000-0000-0000-0000-000000000001';
update public.membership_plans set offer_type = 'percent', offer_value = 10
where id = 'f2000000-0000-0000-0000-000000000001';

\echo 'O3 The owner puts Monthly on 10% off for 10 days (expect UPDATE 1, then 108000, Diwali offer)'
update public.membership_plans
set offer_type = 'percent', offer_value = 10, offer_label = 'Diwali offer', offer_ends_on = current_date + 10
where id = 'f2000000-0000-0000-0000-000000000001';
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000b');
select * from public.my_plan_price('f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001');

\echo 'O4 Percent offers round to whole rupees: 10% off 3499 is 3149 (expect 314900)'
reset role;
update public.membership_plans set offer_type = 'percent', offer_value = 10, offer_ends_on = current_date + 10
where id = 'f2000000-0000-0000-0000-000000000002';
set role authenticated;
select price_cents from public.my_plan_price('f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000002');

\echo 'O5 An ended or not yet started offer takes nothing off (expect 0, then 0)'
select public.plan_offer_cents(p, current_date + 11)
from public.membership_plans p where id = 'f2000000-0000-0000-0000-000000000001';
reset role;
update public.membership_plans set offer_starts_on = current_date + 1
where id = 'f2000000-0000-0000-0000-000000000002';
select public.plan_offer_cents(p, current_date)
from public.membership_plans p where id = 'f2000000-0000-0000-0000-000000000002';
update public.membership_plans set offer_starts_on = null
where id = 'f2000000-0000-0000-0000-000000000002';
set role authenticated;

\echo 'O6 Supervisors and members can''t set the loyalty offer (expect Only owners..., twice)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000d');
select public.set_loyalty_offer('f1000000-0000-0000-0000-000000000001', 2, 15);
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000b');
select public.set_loyalty_offer('f1000000-0000-0000-0000-000000000001', 2, 15);

\echo 'O7 Out of range is refused (expect Pick 1 to 50% off, Set both...)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000a');
select public.set_loyalty_offer('f1000000-0000-0000-0000-000000000001', 2, 60);
select public.set_loyalty_offer('f1000000-0000-0000-0000-000000000001', 2, null);

\echo 'O8 The owner sets 2 months, 15% off; members read it (expect 2, 15)'
select public.set_loyalty_offer('f1000000-0000-0000-0000-000000000001', 2, 15);
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000b');
select loyalty_months, loyalty_percent from public.gyms where id = 'f1000000-0000-0000-0000-000000000001';

\echo 'O9 Lata paid 2 months straight: 15% beats the 10% plan offer (expect 102000, Loyalty offer)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000c');
select * from public.my_plan_price('f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001');

\echo 'O10 Gopi had a 20-day break, so only the plan offer (expect 108000, Diwali offer)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000e');
select * from public.my_plan_price('f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001');

\echo 'O11 Mani has no memberships, so only the plan offer (expect 108000, Diwali offer)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000b');
select * from public.my_plan_price('f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001');

\echo 'O12 Lata starts an online payment at the loyalty price (expect 102000, 102000, Loyalty offer)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000c');
select public.start_online_payment('f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001') is not null;
select amount_cents, base_cents, offer from public.online_payments
where member_id = 'f0000000-0000-0000-0000-00000000000c' order by created_at desc limit 1;

\echo 'O13 Completing it records the offer price and names the offer (expect 102000, Paid online (Razorpay pay_O13) · Loyalty offer)'
reset role;
select public.complete_online_payment(
  (select id from public.online_payments where member_id = 'f0000000-0000-0000-0000-00000000000c' limit 1),
  'pay_O13', 102000, 2000) is not null;
select amount_paid_cents, note from public.memberships
where member_id = 'f0000000-0000-0000-0000-00000000000c' order by ends_on desc limit 1;
set role authenticated;

\echo 'O14 Members can''t call member_plan_price for someone else (expect permission denied)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000b');
select * from public.member_plan_price('f1000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-00000000000c','f2000000-0000-0000-0000-000000000001');

\echo 'O15 Supervisors save an offer; members can''t see or save one (expect INSERT 0 1, 0 rows, RLS error)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000d');
insert into public.saved_offers (gym_id, created_by, title, body) values
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000d','Bring a friend','Both get 10% off.');
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000b');
select count(*) from public.saved_offers;
insert into public.saved_offers (gym_id, created_by, title) values
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000b','Free month');

\echo 'O16 The owner sees and removes it (expect 1, DELETE 1)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000a');
select count(*) from public.saved_offers;
delete from public.saved_offers where title = 'Bring a friend';
reset role;
