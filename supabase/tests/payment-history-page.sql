-- Payment history paging: per-member totals, paying-now first, name search, managers only.
-- Self-contained: run after the migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
begin;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('9a100000-0000-0000-0000-00000000000a','olga@ph.test',now(),'{"full_name":"Olga Owner"}'),
 ('9a100000-0000-0000-0000-00000000000b','mani@ph.test',now(),'{"full_name":"Mani Member"}'),
 ('9a100000-0000-0000-0000-00000000000c','tejas@ph.test',now(),'{"full_name":"Tejas Trainer"}'),
 ('9a100000-0000-0000-0000-00000000000e','rani@ph.test',now(),'{"full_name":"Rani Member"}');
insert into public.brands (id, name) values ('9a500000-0000-0000-0000-000000000001','PH');
insert into public.gyms (id, name, time_zone, brand_id) values
 ('9a200000-0000-0000-0000-000000000001','PH Fitness','Asia/Kolkata','9a500000-0000-0000-0000-000000000001');
update public.gyms set paid_until = current_date + 365 where id = '9a200000-0000-0000-0000-000000000001';
insert into public.gym_members (gym_id, user_id, role) values
 ('9a200000-0000-0000-0000-000000000001','9a100000-0000-0000-0000-00000000000a','owner'),
 ('9a200000-0000-0000-0000-000000000001','9a100000-0000-0000-0000-00000000000b','member'),
 ('9a200000-0000-0000-0000-000000000001','9a100000-0000-0000-0000-00000000000c','trainer'),
 ('9a200000-0000-0000-0000-000000000001','9a100000-0000-0000-0000-00000000000e','member');
update public.gym_members set status = 'suspended'
 where gym_id = '9a200000-0000-0000-0000-000000000001' and user_id = '9a100000-0000-0000-0000-00000000000e';
insert into public.membership_plans (id, gym_id, name, price_cents, duration_days) values
 ('9a300000-0000-0000-0000-000000000001','9a200000-0000-0000-0000-000000000001','Monthly',150000,30);
insert into public.memberships (id, member_id, plan_id, starts_on, ends_on, amount_paid_cents, payment_method, recorded_by) values
 ('9a400000-0000-0000-0000-000000000001','9a100000-0000-0000-0000-00000000000b','9a300000-0000-0000-0000-000000000001', current_date - 60, current_date - 31, 150000, 'cash','9a100000-0000-0000-0000-00000000000a'),
 ('9a400000-0000-0000-0000-000000000002','9a100000-0000-0000-0000-00000000000b','9a300000-0000-0000-0000-000000000001', current_date - 30, current_date, 150000, 'upi','9a100000-0000-0000-0000-00000000000a'),
 ('9a400000-0000-0000-0000-000000000003','9a100000-0000-0000-0000-00000000000e','9a300000-0000-0000-0000-000000000001', current_date, current_date + 29, 150000, 'cash','9a100000-0000-0000-0000-00000000000a');

-- Tejas (trainer) is paying for a plan right now in the app.
insert into public.online_payments (gym_id, member_id, plan_id, amount_cents, currency) values
 ('9a200000-0000-0000-0000-000000000001','9a100000-0000-0000-0000-00000000000c','9a300000-0000-0000-0000-000000000001',150000,'INR');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'PH1 Owner: paying now first, then latest payment (expect Tejas 0 0 1 | Mani 2 300000 0 | Rani 1 150000 0, total 3 each; Mani and Rani were recorded in the same transaction, so name breaks the tie)'
select pg_temp.as_user('9a100000-0000-0000-0000-00000000000a');
select member_name, payments, total_cents, pending, total
from public.gym_payment_history_page('9a200000-0000-0000-0000-000000000001');

\echo 'PH2 Search by name, case-insensitive (expect Mani Member | 1)'
select member_name, total from public.gym_payment_history_page('9a200000-0000-0000-0000-000000000001', 'MANI');

\echo 'PH3 Paging (expect Mani Member | 3)'
select member_name, total from public.gym_payment_history_page('9a200000-0000-0000-0000-000000000001', '', 1, 1);

\echo 'PH4 A trainer is refused (expect ERROR: Only owners and supervisors see payment history)'
select pg_temp.as_user('9a100000-0000-0000-0000-00000000000c');
select * from public.gym_payment_history_page('9a200000-0000-0000-0000-000000000001');

reset role;
rollback;
