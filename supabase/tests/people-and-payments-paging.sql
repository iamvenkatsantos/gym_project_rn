-- People and Payments paging: filter chip counts and each member's latest membership.
-- Self-contained: run after the migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('f5000000-0000-0000-0000-00000000000a','olga@pg.test',now(),'{"full_name":"Olga Owner"}'),
 ('f5000000-0000-0000-0000-00000000000b','mani@pg.test',now(),'{"full_name":"Mani Member"}'),
 ('f5000000-0000-0000-0000-00000000000c','tejas@pg.test',now(),'{"full_name":"Tejas Trainer"}'),
 ('f5000000-0000-0000-0000-00000000000e','rani@pg.test',now(),'{"full_name":"Rani Member"}');
insert into public.gyms (id, name, time_zone) values
 ('f6000000-0000-0000-0000-000000000001','PG Fitness','Asia/Kolkata');
update public.gyms set paid_until = current_date + 365 where id = 'f6000000-0000-0000-0000-000000000001';
insert into public.gym_members (gym_id, user_id, role) values
 ('f6000000-0000-0000-0000-000000000001','f5000000-0000-0000-0000-00000000000a','owner'),
 ('f6000000-0000-0000-0000-000000000001','f5000000-0000-0000-0000-00000000000b','member'),
 ('f6000000-0000-0000-0000-000000000001','f5000000-0000-0000-0000-00000000000c','trainer'),
 ('f6000000-0000-0000-0000-000000000001','f5000000-0000-0000-0000-00000000000e','member');
update public.gym_members set status = 'suspended'
 where gym_id = 'f6000000-0000-0000-0000-000000000001' and user_id = 'f5000000-0000-0000-0000-00000000000e';
insert into public.membership_plans (id, gym_id, name, price_cents, duration_days) values
 ('f7000000-0000-0000-0000-000000000001','f6000000-0000-0000-0000-000000000001','Monthly',150000,30);
insert into public.memberships (id, member_id, plan_id, starts_on, ends_on, amount_paid_cents, payment_method, recorded_by) values
 ('f8000000-0000-0000-0000-000000000001','f5000000-0000-0000-0000-00000000000b','f7000000-0000-0000-0000-000000000001', current_date - 60, current_date - 31, 150000, 'cash','f5000000-0000-0000-0000-00000000000a'),
 ('f8000000-0000-0000-0000-000000000002','f5000000-0000-0000-0000-00000000000b','f7000000-0000-0000-0000-000000000001', current_date - 30, current_date, 150000, 'upi','f5000000-0000-0000-0000-00000000000a'),
 ('f8000000-0000-0000-0000-000000000003','f5000000-0000-0000-0000-00000000000e','f7000000-0000-0000-0000-000000000001', current_date, current_date + 29, 150000, 'cash','f5000000-0000-0000-0000-00000000000a');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'PG1 The owner sees the chip counts (expect 4 | 1 | 1 | 0 | 1 | 1)'
select pg_temp.as_user('f5000000-0000-0000-0000-00000000000a');
select * from public.gym_people_counts('f6000000-0000-0000-0000-000000000001');

\echo 'PG2 A trainer gets zeros (expect 0 | 0)'
select pg_temp.as_user('f5000000-0000-0000-0000-00000000000c');
select everyone, member from public.gym_people_counts('f6000000-0000-0000-0000-000000000001');

\echo 'PG3 The owner gets one latest membership per member (expect f8...02 | f8...03)'
select pg_temp.as_user('f5000000-0000-0000-0000-00000000000a');
select id from public.gym_latest_memberships('f6000000-0000-0000-0000-000000000001') order by ends_on;

\echo 'PG4 A member sees only their own (expect f8...02)'
select pg_temp.as_user('f5000000-0000-0000-0000-00000000000b');
select id from public.gym_latest_memberships('f6000000-0000-0000-0000-000000000001');

reset role;
