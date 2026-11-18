-- Staff Payment history paging: one line per member, paying-now first, search and paging, and
-- only what the caller may see. Self-contained: run after the migrations.
\set ON_ERROR_STOP 0
begin;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('c5000000-0000-0000-0000-00000000000a','olga@ph.test',now(),'{"full_name":"Olga Owner"}'),
 ('c5000000-0000-0000-0000-00000000000b','mani@ph.test',now(),'{"full_name":"Mani Member"}'),
 ('c5000000-0000-0000-0000-00000000000c','tejas@ph.test',now(),'{"full_name":"Tejas Trainer"}'),
 ('c5000000-0000-0000-0000-00000000000e','rani@ph.test',now(),'{"full_name":"Rani Member"}'),
 ('c5000000-0000-0000-0000-00000000000f','zed@ph.test',now(),'{"full_name":"Zed 100% Member"}');
insert into public.brands (id, name) values ('c6100000-0000-0000-0000-000000000001','PH');
insert into public.gyms (id, name, time_zone, brand_id) values
 ('c6000000-0000-0000-0000-000000000001','PH Fitness','Asia/Kolkata','c6100000-0000-0000-0000-000000000001');
update public.gyms set paid_until = current_date + 365 where id = 'c6000000-0000-0000-0000-000000000001';
insert into public.gym_members (gym_id, user_id, role) values
 ('c6000000-0000-0000-0000-000000000001','c5000000-0000-0000-0000-00000000000a','owner'),
 ('c6000000-0000-0000-0000-000000000001','c5000000-0000-0000-0000-00000000000b','member'),
 ('c6000000-0000-0000-0000-000000000001','c5000000-0000-0000-0000-00000000000c','trainer'),
 ('c6000000-0000-0000-0000-000000000001','c5000000-0000-0000-0000-00000000000e','member'),
 ('c6000000-0000-0000-0000-000000000001','c5000000-0000-0000-0000-00000000000f','member');
insert into public.membership_plans (id, gym_id, name, price_cents, duration_days) values
 ('c7000000-0000-0000-0000-000000000001','c6000000-0000-0000-0000-000000000001','Monthly',150000,30);
insert into public.memberships (id, member_id, plan_id, starts_on, ends_on, amount_paid_cents, payment_method, recorded_by, created_at) values
 ('c8000000-0000-0000-0000-000000000001','c5000000-0000-0000-0000-00000000000b','c7000000-0000-0000-0000-000000000001', current_date - 60, current_date - 31, 150000, 'cash','c5000000-0000-0000-0000-00000000000a', now() - interval '60 days'),
 ('c8000000-0000-0000-0000-000000000002','c5000000-0000-0000-0000-00000000000b','c7000000-0000-0000-0000-000000000001', current_date - 30, current_date, 100000, 'upi','c5000000-0000-0000-0000-00000000000a', now() - interval '30 days'),
 ('c8000000-0000-0000-0000-000000000003','c5000000-0000-0000-0000-00000000000e','c7000000-0000-0000-0000-000000000001', current_date, current_date + 29, 150000, 'cash','c5000000-0000-0000-0000-00000000000a', now() - interval '1 day');
-- Zed has no membership yet but is paying in the app right now; Mani's old link has expired.
insert into public.online_payments (gym_id, member_id, plan_id, amount_cents, currency, status, created_at) values
 ('c6000000-0000-0000-0000-000000000001','c5000000-0000-0000-0000-00000000000f','c7000000-0000-0000-0000-000000000001',150000,'INR','created', now() - interval '2 minutes'),
 ('c6000000-0000-0000-0000-000000000001','c5000000-0000-0000-0000-00000000000b','c7000000-0000-0000-0000-000000000001',150000,'INR','created', now() - interval '3 hours');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'PH1 Owner: Zed (paying now) first, then Rani (yesterday), then Mani with 2 payments, 250000 (expect Zed 0|0|1, Rani 1|150000|0, Mani 2|250000|0, total 3)'
select pg_temp.as_user('c5000000-0000-0000-0000-00000000000a');
select member_name, payments, total_cents, pending, total
from public.gym_payment_history_page('c6000000-0000-0000-0000-000000000001');

\echo 'PH2 Search: "100%" matches only Zed (percent taken literally); "ani" matches Mani and Rani'
select member_name from public.gym_payment_history_page('c6000000-0000-0000-0000-000000000001', '100%');
select member_name from public.gym_payment_history_page('c6000000-0000-0000-0000-000000000001', 'ani');

\echo 'PH3 Paging: limit 1 offset 1 gives Rani, total still 3'
select member_name, total from public.gym_payment_history_page('c6000000-0000-0000-0000-000000000001', '', 1, 1);

\echo 'PH4 A member sees only their own line (expect Mani 2|250000)'
select pg_temp.as_user('c5000000-0000-0000-0000-00000000000b');
select member_name, payments, total_cents from public.gym_payment_history_page('c6000000-0000-0000-0000-000000000001');

\echo 'PH5 Bad page is refused (expect error)'
select * from public.gym_payment_history_page('c6000000-0000-0000-0000-000000000001', '', 0, 0);

reset role;
rollback;
