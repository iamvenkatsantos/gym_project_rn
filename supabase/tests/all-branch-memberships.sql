-- All-branch memberships: members on an "All branches" plan check in at any branch of their
-- brand and train there. Self-contained: run after the migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, raw_user_meta_data, email_confirmed_at) values
 ('ad000000-0000-0000-0000-00000000000a','{"full_name":"Asha Owner"}',now()),
 ('ad000000-0000-0000-0000-00000000000b','{"full_name":"Bala Allbranch"}',now()),
 ('ad000000-0000-0000-0000-00000000000c','{"full_name":"Chitra Onebranch"}',now()),
 ('ad000000-0000-0000-0000-00000000000d','{"full_name":"Dev Otherbrand"}',now()),
 ('ad000000-0000-0000-0000-00000000000e','{"full_name":"Esha Expired"}',now()),
 ('ad000000-0000-0000-0000-00000000000f','{"full_name":"Farid Owner B"}',now());
insert into public.brands (id, name) values
 ('ad300000-0000-0000-0000-000000000001','Pass Gym'),
 ('ad300000-0000-0000-0000-000000000002','Other Gym');
insert into public.gyms (id, name, brand_id) values
 ('ad100000-0000-0000-0000-000000000001','Pass Gym Anna Nagar','ad300000-0000-0000-0000-000000000001'),
 ('ad100000-0000-0000-0000-000000000002','Pass Gym Velachery','ad300000-0000-0000-0000-000000000001'),
 ('ad100000-0000-0000-0000-000000000003','Other Gym','ad300000-0000-0000-0000-000000000002');
insert into public.gym_members (gym_id, user_id, role) values
 ('ad100000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-00000000000a','owner'),
 ('ad100000-0000-0000-0000-000000000002','ad000000-0000-0000-0000-00000000000a','owner'),
 ('ad100000-0000-0000-0000-000000000002','ad000000-0000-0000-0000-00000000000f','supervisor'),
 ('ad100000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-00000000000b','member'),
 ('ad100000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-00000000000c','member'),
 ('ad100000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-00000000000e','member'),
 ('ad100000-0000-0000-0000-000000000003','ad000000-0000-0000-0000-00000000000d','member');
insert into public.membership_plans (id, gym_id, name, price_cents, duration_days, all_branches) values
 ('ad200000-0000-0000-0000-000000000001','ad100000-0000-0000-0000-000000000001','Gold',300000,30,true),
 ('ad200000-0000-0000-0000-000000000002','ad100000-0000-0000-0000-000000000001','Basic',150000,30,false),
 ('ad200000-0000-0000-0000-000000000003','ad100000-0000-0000-0000-000000000003','Other',150000,30,true);
insert into public.memberships (member_id, plan_id, starts_on, ends_on) values
 ('ad000000-0000-0000-0000-00000000000b','ad200000-0000-0000-0000-000000000001',current_date - 2, current_date + 27),
 ('ad000000-0000-0000-0000-00000000000c','ad200000-0000-0000-0000-000000000002',current_date - 2, current_date + 27),
 ('ad000000-0000-0000-0000-00000000000d','ad200000-0000-0000-0000-000000000003',current_date - 2, current_date + 27),
 ('ad000000-0000-0000-0000-00000000000e','ad200000-0000-0000-0000-000000000001',current_date - 31, current_date - 1);

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
-- Codes are made on first read; the supervisor reads them, then the poster code is fetched as
-- the table owner.
set role authenticated;
select pg_temp.as_user('ad000000-0000-0000-0000-00000000000f');
select count(*) from public.check_in_qr('ad100000-0000-0000-0000-000000000002');
reset role;
select poster_code as velachery from public.gym_check_in_codes
where gym_id = 'ad100000-0000-0000-0000-000000000002' \gset
set role authenticated;

\echo 'A1 Bala (Gold, all branches) scans Velachery (expect in, Pass Gym Velachery)'
select pg_temp.as_user('ad000000-0000-0000-0000-00000000000b');
select action, gym_name from public.scan_check_in('ad100000-0000-0000-0000-000000000002', :'velachery');

\echo 'A2 Bala''s Home at Anna Nagar shows the visit (expect Pass Gym Velachery, open)'
select gym_name, checked_out_at is null as open
from public.my_attendance_today('ad100000-0000-0000-0000-000000000001');

\echo 'A3 He can start a workout from his home branch (expect no error)'
select public.start_workout_attendance('ad100000-0000-0000-0000-000000000001', gen_random_uuid(), 'Push');

\echo 'A4 Chitra (Basic, one branch) scans Velachery (expect This QR is for Pass Gym Velachery. Your plan works at Pass Gym Anna Nagar only.)'
select pg_temp.as_user('ad000000-0000-0000-0000-00000000000c');
select action from public.scan_check_in('ad100000-0000-0000-0000-000000000002', :'velachery');

\echo 'A5 Esha (Gold, expired) scans Velachery (expect Your plan works at ... only)'
select pg_temp.as_user('ad000000-0000-0000-0000-00000000000e');
select action from public.scan_check_in('ad100000-0000-0000-0000-000000000002', :'velachery');

\echo 'A6 Dev (all branches at another brand) scans Velachery (expect You aren''t a member of Pass Gym Velachery)'
select pg_temp.as_user('ad000000-0000-0000-0000-00000000000d');
select action from public.scan_check_in('ad100000-0000-0000-0000-000000000002', :'velachery');

\echo 'A7 Velachery''s supervisor sees Bala as a visitor from Anna Nagar (expect Bala Allbranch, member, Pass Gym Anna Nagar)'
select pg_temp.as_user('ad000000-0000-0000-0000-00000000000f');
select full_name, role, home_branch from public.gym_attendance('ad100000-0000-0000-0000-000000000002')
where home_branch is not null;

\echo 'A8 Bala checks in at home with the button: the Velachery visit closes (expect Anna Nagar open, Velachery closed)'
select pg_temp.as_user('ad000000-0000-0000-0000-00000000000b');
select (public.check_in('ad100000-0000-0000-0000-000000000001')).day is not null;
reset role;
select g.name, a.checked_out_at is null as open from public.attendance a join public.gyms g on g.id = a.gym_id
where a.user_id = 'ad000000-0000-0000-0000-00000000000b' order by g.name;
set role authenticated;

\echo 'A9 Back to Velachery on the QR, then Check out on Home ends that visit (expect in, t, then Pass Gym Anna Nagar f)'
select pg_temp.as_user('ad000000-0000-0000-0000-00000000000b');
select action from public.scan_check_in('ad100000-0000-0000-0000-000000000002', :'velachery');
select (public.check_out('ad100000-0000-0000-0000-000000000001')).gym_id = 'ad100000-0000-0000-0000-000000000002' as closed_velachery;
select gym_name, checked_out_at is null as open
from public.my_attendance_today('ad100000-0000-0000-0000-000000000001');

\echo 'A10 Chitra''s home check-in still works (expect t)'
select pg_temp.as_user('ad000000-0000-0000-0000-00000000000c');
select (public.check_in('ad100000-0000-0000-0000-000000000001')).day is not null;

\echo 'A11 Members can''t mark a plan all branches (expect 0 rows changed)'
update public.membership_plans set all_branches = true
where id = 'ad200000-0000-0000-0000-000000000002';
reset role;
select all_branches from public.membership_plans where id = 'ad200000-0000-0000-0000-000000000002';
set role authenticated;

\echo 'A12 The owner can (expect t)'
select pg_temp.as_user('ad000000-0000-0000-0000-00000000000a');
update public.membership_plans set all_branches = true
where id = 'ad200000-0000-0000-0000-000000000002';
reset role;
select all_branches from public.membership_plans where id = 'ad200000-0000-0000-0000-000000000002';
