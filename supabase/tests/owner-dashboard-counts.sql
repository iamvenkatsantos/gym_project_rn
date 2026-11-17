-- Owner Home counts: the tile numbers from owner_dashboard_counts(), and only for managers.
-- Self-contained: run after the migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
begin;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('b9000000-0000-0000-0000-00000000000a','olga@od.test',now(),'{"full_name":"Olga Owner"}'),
 ('b9000000-0000-0000-0000-00000000000b','mani@od.test',now(),'{"full_name":"Mani Member"}'),
 ('b9000000-0000-0000-0000-00000000000c','tejas@od.test',now(),'{"full_name":"Tejas Trainer"}'),
 ('b9000000-0000-0000-0000-00000000000e','rani@od.test',now(),'{"full_name":"Rani Member"}');
insert into public.brands (id, name) values ('ba100000-0000-0000-0000-000000000001','OD');
insert into public.gyms (id, name, time_zone, brand_id) values
 ('ba000000-0000-0000-0000-000000000001','OD Fitness','Asia/Kolkata','ba100000-0000-0000-0000-000000000001');
update public.gyms set paid_until = current_date + 365 where id = 'ba000000-0000-0000-0000-000000000001';
insert into public.gym_members (gym_id, user_id, role) values
 ('ba000000-0000-0000-0000-000000000001','b9000000-0000-0000-0000-00000000000a','owner'),
 ('ba000000-0000-0000-0000-000000000001','b9000000-0000-0000-0000-00000000000b','member'),
 ('ba000000-0000-0000-0000-000000000001','b9000000-0000-0000-0000-00000000000c','trainer'),
 ('ba000000-0000-0000-0000-000000000001','b9000000-0000-0000-0000-00000000000e','member');
update public.gym_members set status = 'suspended'
 where gym_id = 'ba000000-0000-0000-0000-000000000001' and user_id = 'b9000000-0000-0000-0000-00000000000e';
insert into public.membership_plans (id, gym_id, name, price_cents, duration_days) values
 ('bb000000-0000-0000-0000-000000000001','ba000000-0000-0000-0000-000000000001','Monthly',150000,30);
insert into public.memberships (id, member_id, plan_id, starts_on, ends_on, amount_paid_cents, payment_method, recorded_by) values
 ('bc000000-0000-0000-0000-000000000001','b9000000-0000-0000-0000-00000000000b','bb000000-0000-0000-0000-000000000001', current_date - 60, current_date - 31, 150000, 'cash','b9000000-0000-0000-0000-00000000000a'),
 ('bc000000-0000-0000-0000-000000000002','b9000000-0000-0000-0000-00000000000b','bb000000-0000-0000-0000-000000000001', current_date - 30, current_date, 150000, 'upi','b9000000-0000-0000-0000-00000000000a'),
 ('bc000000-0000-0000-0000-000000000003','b9000000-0000-0000-0000-00000000000e','bb000000-0000-0000-0000-000000000001', current_date, current_date + 29, 150000, 'cash','b9000000-0000-0000-0000-00000000000a');

-- Mani has a trainer; Rani (suspended) doesn't count anywhere. Mani's birthday is the gym's today.
insert into public.member_trainers (gym_id, member_id, trainer_id) values
 ('ba000000-0000-0000-0000-000000000001','b9000000-0000-0000-0000-00000000000b','b9000000-0000-0000-0000-00000000000c');
insert into public.contact_details (user_id, phone, date_of_birth) values
 ('b9000000-0000-0000-0000-00000000000b','9876500001', public.gym_day('ba000000-0000-0000-0000-000000000001') - interval '30 years')
on conflict (user_id) do update set date_of_birth = excluded.date_of_birth;
insert into public.attendance (gym_id, user_id, day, role, checked_in_at) values
 ('ba000000-0000-0000-0000-000000000001','b9000000-0000-0000-0000-00000000000b', public.gym_day('ba000000-0000-0000-0000-000000000001'), 'member', now());

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'OD1 Owner sees the counts (expect 2 | 0 | 1 | 1 | 0 | 1: Rani is suspended but her membership still counts, as on the app's tile)'
select pg_temp.as_user('b9000000-0000-0000-0000-00000000000a');
select * from public.owner_dashboard_counts('ba000000-0000-0000-0000-000000000001', current_date);

\echo 'OD2 A trainer is refused (expect ERROR: Only owners and supervisors see the dashboard)'
select pg_temp.as_user('b9000000-0000-0000-0000-00000000000c');
select * from public.owner_dashboard_counts('ba000000-0000-0000-0000-000000000001', current_date);

reset role;
rollback;
