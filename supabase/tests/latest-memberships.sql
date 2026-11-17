-- Payments tab paging: each member's latest membership, and only what the caller may see.
-- Self-contained: run after the migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('b5000000-0000-0000-0000-00000000000a','olga@lm.test',now(),'{"full_name":"Olga Owner"}'),
 ('b5000000-0000-0000-0000-00000000000b','mani@lm.test',now(),'{"full_name":"Mani Member"}'),
 ('b5000000-0000-0000-0000-00000000000c','tejas@lm.test',now(),'{"full_name":"Tejas Trainer"}'),
 ('b5000000-0000-0000-0000-00000000000e','rani@lm.test',now(),'{"full_name":"Rani Member"}');
insert into public.gyms (id, name, time_zone) values
 ('b6000000-0000-0000-0000-000000000001','LM Fitness','Asia/Kolkata');
update public.gyms set paid_until = current_date + 365 where id = 'b6000000-0000-0000-0000-000000000001';
insert into public.gym_members (gym_id, user_id, role) values
 ('b6000000-0000-0000-0000-000000000001','b5000000-0000-0000-0000-00000000000a','owner'),
 ('b6000000-0000-0000-0000-000000000001','b5000000-0000-0000-0000-00000000000b','member'),
 ('b6000000-0000-0000-0000-000000000001','b5000000-0000-0000-0000-00000000000c','trainer'),
 ('b6000000-0000-0000-0000-000000000001','b5000000-0000-0000-0000-00000000000e','member');
update public.gym_members set status = 'suspended'
 where gym_id = 'b6000000-0000-0000-0000-000000000001' and user_id = 'b5000000-0000-0000-0000-00000000000e';
insert into public.membership_plans (id, gym_id, name, price_cents, duration_days) values
 ('b7000000-0000-0000-0000-000000000001','b6000000-0000-0000-0000-000000000001','Monthly',150000,30);
insert into public.memberships (id, member_id, plan_id, starts_on, ends_on, amount_paid_cents, payment_method, recorded_by) values
 ('b8000000-0000-0000-0000-000000000001','b5000000-0000-0000-0000-00000000000b','b7000000-0000-0000-0000-000000000001', current_date - 60, current_date - 31, 150000, 'cash','b5000000-0000-0000-0000-00000000000a'),
 ('b8000000-0000-0000-0000-000000000002','b5000000-0000-0000-0000-00000000000b','b7000000-0000-0000-0000-000000000001', current_date - 30, current_date, 150000, 'upi','b5000000-0000-0000-0000-00000000000a'),
 ('b8000000-0000-0000-0000-000000000003','b5000000-0000-0000-0000-00000000000e','b7000000-0000-0000-0000-000000000001', current_date, current_date + 29, 150000, 'cash','b5000000-0000-0000-0000-00000000000a');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'LM1 The owner gets one latest membership per member (expect b8...02 | b8...03)'
select pg_temp.as_user('b5000000-0000-0000-0000-00000000000a');
select id from public.gym_latest_memberships('b6000000-0000-0000-0000-000000000001') order by ends_on;

\echo 'LM2 A member sees only their own (expect b8...02)'
select pg_temp.as_user('b5000000-0000-0000-0000-00000000000b');
select id from public.gym_latest_memberships('b6000000-0000-0000-0000-000000000001');

reset role;
