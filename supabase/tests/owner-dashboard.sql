-- Owner Home numbers (2026-11-17): owner_dashboard_counts / gym_renewals_due give what the app's
-- membershipStatus / renewalsDue / unmappedMembers / isBirthdayToday work out. Self-contained: run
-- after the migrations. Every check prints ok or FAIL. "today" is fixed at 2026-11-17.
\set ON_ERROR_STOP 0
\set ON_ERROR_ROLLBACK on
begin;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('d1000000-0000-0000-0000-00000000000a','owner@od.test',now(),'{"full_name":"Od Owner"}'),
 ('d1000000-0000-0000-0000-00000000000b','trainer@od.test',now(),'{"full_name":"Od Trainer"}'),
 ('d1000000-0000-0000-0000-00000000000d','other@od.test',now(),'{"full_name":"Other Owner"}');
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select ('d2000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'm' || n || '@od.test', now(),
       jsonb_build_object('full_name', 'Member ' || n)
from generate_series(1, 12) n;
insert into public.brands (id, name) values ('d1200000-0000-0000-0000-000000000001','OD'),('d1200000-0000-0000-0000-000000000002','OD2');
insert into public.gyms (id, name, brand_id, paid_until) values
 ('d1300000-0000-0000-0000-00000000000a','OD Gym','d1200000-0000-0000-0000-000000000001', current_date + 300),
 ('d1300000-0000-0000-0000-00000000000b','OD Other','d1200000-0000-0000-0000-000000000002', current_date + 300);
insert into public.gym_members (gym_id, user_id, role) values
 ('d1300000-0000-0000-0000-00000000000a','d1000000-0000-0000-0000-00000000000a','owner'),
 ('d1300000-0000-0000-0000-00000000000a','d1000000-0000-0000-0000-00000000000b','trainer'),
 ('d1300000-0000-0000-0000-00000000000b','d1000000-0000-0000-0000-00000000000d','owner');
insert into public.gym_members (gym_id, user_id, role)
select 'd1300000-0000-0000-0000-00000000000a', ('d2000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'member'
from generate_series(1, 12) n;
update public.gym_members set status = 'suspended' where user_id = 'd2000000-0000-0000-0000-000000000012'::uuid;
insert into public.membership_plans (id, gym_id, name, price_cents, duration_days) values
 ('d1400000-0000-0000-0000-00000000000a','d1300000-0000-0000-0000-00000000000a','Monthly',100000,30);

-- today = 2026-11-17. Member n and its (starts_on, ends_on):
--  1 ends today (1 day left: renewal)         2 ends in 6 days (7 left: renewal)
--  3 ends in 7 days (8 left: active only)     4 ended yesterday (renewal)
--  5 ended 30 days ago (renewal)              6 ended 31 days ago (lapsed: nothing)
--  7 starts tomorrow (upcoming: nothing)      8 old ended + newer running (active only, one row)
--  9 two memberships ending the same day, in 3 days (4 left: renewal)   10 no membership
insert into public.memberships (member_id, plan_id, starts_on, ends_on, amount_paid_cents, payment_method, created_at) values
 ('d2000000-0000-0000-0000-000000000001','d1400000-0000-0000-0000-00000000000a','2026-10-19','2026-11-17',100000,'cash', now()),
 ('d2000000-0000-0000-0000-000000000002','d1400000-0000-0000-0000-00000000000a','2026-10-24','2026-11-23',100000,'cash', now()),
 ('d2000000-0000-0000-0000-000000000003','d1400000-0000-0000-0000-00000000000a','2026-10-25','2026-11-24',100000,'cash', now()),
 ('d2000000-0000-0000-0000-000000000004','d1400000-0000-0000-0000-00000000000a','2026-10-18','2026-11-16',100000,'cash', now()),
 ('d2000000-0000-0000-0000-000000000005','d1400000-0000-0000-0000-00000000000a','2026-09-18','2026-10-18',100000,'cash', now()),
 ('d2000000-0000-0000-0000-000000000006','d1400000-0000-0000-0000-00000000000a','2026-09-17','2026-10-17',100000,'cash', now()),
 ('d2000000-0000-0000-0000-000000000007','d1400000-0000-0000-0000-00000000000a','2026-11-18','2026-12-17',100000,'cash', now()),
 ('d2000000-0000-0000-0000-000000000008','d1400000-0000-0000-0000-00000000000a','2026-08-01','2026-08-31',100000,'cash', now()),
 ('d2000000-0000-0000-0000-000000000008','d1400000-0000-0000-0000-00000000000a','2026-11-01','2026-12-31',100000,'cash', now()),
 ('d2000000-0000-0000-0000-000000000009','d1400000-0000-0000-0000-00000000000a','2026-10-01','2026-11-20',100000,'cash', now()),
 ('d2000000-0000-0000-0000-000000000009','d1400000-0000-0000-0000-00000000000a','2026-10-05','2026-11-20',100000,'cash', now());
-- Trainer links: members 1-3 have one. Members 4-11 and (suspended) 12 do not.
insert into public.member_trainers (gym_id, member_id, trainer_id)
select 'd1300000-0000-0000-0000-00000000000a', ('d2000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'd1000000-0000-0000-0000-00000000000b'
from generate_series(1, 3) n;
-- Birthdays: member 1 today, member 2 yesterday, member 3 on 29 Feb (not today), member 12 today but suspended.
insert into public.contact_details (user_id, phone, date_of_birth) values
 ('d2000000-0000-0000-0000-000000000001','9000000001','1990-11-17'),
 ('d2000000-0000-0000-0000-000000000002','9000000002','1990-11-16'),
 ('d2000000-0000-0000-0000-000000000003','9000000003','1992-02-29'),
 ('d2000000-0000-0000-0000-000000000012','9000000012','1990-11-17');
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;
select pg_temp.as_user('d1000000-0000-0000-0000-00000000000a');

\echo 'D1 counts (expect 5 | 5 | 8 | 1): active 1,2,3,8,9; renewals 1,2,4,5,9; no trainer 4-11; birthday member 1 only'
select active_members, renewals_due, no_trainer, birthdays_today
from public.owner_dashboard_counts('d1300000-0000-0000-0000-00000000000a', date '2026-11-17');

\echo 'D2 renewals listed soonest first, one row per member (expect members 05, 04, 01, 09, 02 in this order)'
select right(member_id::text, 2) as member, ends_on
from public.gym_renewals_due('d1300000-0000-0000-0000-00000000000a', date '2026-11-17', 10);

\echo 'D3 the limit applies (expect 2 rows)'
select count(*) from public.gym_renewals_due('d1300000-0000-0000-0000-00000000000a', date '2026-11-17', 2);

\echo 'D3b The Renewals screen asks for up to 1000 (expect 5 rows)'
select count(*) from public.gym_renewals_due('d1300000-0000-0000-0000-00000000000a', date '2026-11-17', 1000);

\echo 'D4 29 Feb counts on 28 Feb in a year without one (expect 1, then 1 on a leap year 29 Feb, 0 on 28 Feb of that leap year)'
select birthdays_today from public.owner_dashboard_counts('d1300000-0000-0000-0000-00000000000a', date '2027-02-28');
select birthdays_today from public.owner_dashboard_counts('d1300000-0000-0000-0000-00000000000a', date '2028-02-29');
select birthdays_today from public.owner_dashboard_counts('d1300000-0000-0000-0000-00000000000a', date '2028-02-28');

\echo 'D5 a trainer gets zeros and no rows (expect 0 | 0 | 0 | 0, then 0)'
select pg_temp.as_user('d1000000-0000-0000-0000-00000000000b');
select active_members, renewals_due, no_trainer, birthdays_today
from public.owner_dashboard_counts('d1300000-0000-0000-0000-00000000000a', date '2026-11-17');
select count(*) from public.gym_renewals_due('d1300000-0000-0000-0000-00000000000a', date '2026-11-17', 10);

\echo 'D6 another gym''s owner gets zeros and no rows (expect 0 | 0 | 0 | 0, then 0)'
select pg_temp.as_user('d1000000-0000-0000-0000-00000000000d');
select active_members, renewals_due, no_trainer, birthdays_today
from public.owner_dashboard_counts('d1300000-0000-0000-0000-00000000000a', date '2026-11-17');
select count(*) from public.gym_renewals_due('d1300000-0000-0000-0000-00000000000a', date '2026-11-17', 10);

\echo 'D7 anon cannot call it (expect permission denied)'
reset role; set role anon;
select * from public.owner_dashboard_counts('d1300000-0000-0000-0000-00000000000a', date '2026-11-17');
rollback;
