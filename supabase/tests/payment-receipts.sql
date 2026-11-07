-- Payment receipts: numbers per branch, frozen once given, and who can open one.
-- Self-contained: run after the migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('f0000000-0000-0000-0000-00000000000a','olga@pr.test',now(),'{"full_name":"Olga Owner"}'),
 ('f0000000-0000-0000-0000-00000000000b','mani@pr.test',now(),'{"full_name":"Mani Member"}'),
 ('f0000000-0000-0000-0000-00000000000c','tejas@pr.test',now(),'{"full_name":"Tejas Trainer"}'),
 ('f0000000-0000-0000-0000-00000000000d','sara@pr.test',now(),'{"full_name":"Sara Supervisor"}'),
 ('f0000000-0000-0000-0000-00000000000e','rani@pr.test',now(),'{"full_name":"Rani Member"}');
insert into public.brands (id, name) values ('f3000000-0000-0000-0000-000000000001','PR Fitness');
insert into public.gyms (id, name, brand_id, time_zone, address, city, phone) values
 ('f1000000-0000-0000-0000-000000000001','PR Fitness Anna Nagar','f3000000-0000-0000-0000-000000000001','Asia/Kolkata','12 2nd Avenue','Chennai','04412345678'),
 ('f1000000-0000-0000-0000-000000000002','PR Fitness Velachery','f3000000-0000-0000-0000-000000000001','Asia/Kolkata','',''  ,'');
update public.gyms set paid_until = current_date + 365 where paid_until is null;
insert into public.gym_members (gym_id, user_id, role) values
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000a','owner'),
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000b','member'),
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000c','trainer'),
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000d','supervisor'),
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000e','member'),
 ('f1000000-0000-0000-0000-000000000002','f0000000-0000-0000-0000-00000000000a','owner'),
 ('f1000000-0000-0000-0000-000000000002','f0000000-0000-0000-0000-00000000000e','member');
insert into public.membership_plans (id, gym_id, name, price_cents, duration_days) values
 ('f2000000-0000-0000-0000-000000000001','f1000000-0000-0000-0000-000000000001','Monthly',150000,30),
 ('f2000000-0000-0000-0000-000000000002','f1000000-0000-0000-0000-000000000002','Monthly',120000,30);

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;

insert into public.memberships (id, member_id, plan_id, starts_on, ends_on, amount_paid_cents, payment_method, recorded_by) values
 ('f4000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000b','f2000000-0000-0000-0000-000000000001', current_date - 60, current_date - 31, 150000, 'cash','f0000000-0000-0000-0000-00000000000a'),
 ('f4000000-0000-0000-0000-000000000002','f0000000-0000-0000-0000-00000000000e','f2000000-0000-0000-0000-000000000001', current_date, current_date + 29, 0, 'complimentary','f0000000-0000-0000-0000-00000000000a'),
 ('f4000000-0000-0000-0000-000000000003','f0000000-0000-0000-0000-00000000000b','f2000000-0000-0000-0000-000000000001', current_date - 30, current_date, 150000, 'upi','f0000000-0000-0000-0000-00000000000a'),
 ('f4000000-0000-0000-0000-000000000004','f0000000-0000-0000-0000-00000000000e','f2000000-0000-0000-0000-000000000002', current_date, current_date + 29, 120000, 'cash','f0000000-0000-0000-0000-00000000000a');

\echo 'R1 Paid memberships are numbered per branch; complimentary gets none (expect 1 | null | 2 | 1)'
select id, receipt_no from public.memberships where id::text like 'f4%' order by id;

\echo 'R2 A number can''t be changed by hand (expect 1)'
update public.memberships set receipt_no = 99 where id = 'f4000000-0000-0000-0000-000000000001';
select receipt_no from public.memberships where id = 'f4000000-0000-0000-0000-000000000001';

\echo 'R3 Extending the end date keeps the number (expect 2)'
update public.memberships set ends_on = ends_on + 5 where id = 'f4000000-0000-0000-0000-000000000003';
select receipt_no from public.memberships where id = 'f4000000-0000-0000-0000-000000000003';

\echo 'R4 The member opens their receipt with the branch address (expect 2 | PR Fitness Anna Nagar | 12 2nd Avenue | Chennai | Mani Member | 150000 | upi | Olga Owner)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000b');
select r->>'receipt_no', r->>'gym_name', r->>'address', r->>'city', r->>'member_name',
  r->>'amount_cents', r->>'payment_method', r->>'received_by'
from public.membership_receipt('f4000000-0000-0000-0000-000000000003') r;

\echo 'R5 Another member gets nothing (expect t)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000e');
select public.membership_receipt('f4000000-0000-0000-0000-000000000003') is null;

\echo 'R6 A trainer gets nothing (expect t)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000c');
select public.membership_receipt('f4000000-0000-0000-0000-000000000003') is null;

\echo 'R7 Supervisor and owner can open it (expect f | f)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000d');
select public.membership_receipt('f4000000-0000-0000-0000-000000000003') is null;
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000a');
select public.membership_receipt('f4000000-0000-0000-0000-000000000003') is null;

\echo 'R8 Complimentary has no receipt (expect t)'
select public.membership_receipt('f4000000-0000-0000-0000-000000000002') is null;

\echo 'R9 The next payment at the branch takes the next number (expect 3)'
insert into public.memberships (id, member_id, plan_id, starts_on, ends_on, amount_paid_cents, payment_method) values
 ('f4000000-0000-0000-0000-000000000005','f0000000-0000-0000-0000-00000000000b','f2000000-0000-0000-0000-000000000001', current_date + 1, current_date + 30, 150000, 'card');
select receipt_no from public.memberships where id = 'f4000000-0000-0000-0000-000000000005';

\echo 'R10 Apps can''t read the counter (expect permission denied)'
set role authenticated;
select last_receipt_no from public.gyms limit 1;
reset role;
