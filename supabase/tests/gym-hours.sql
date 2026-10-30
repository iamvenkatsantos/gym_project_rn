-- Opening hours: who sets them, and auto check-out at closing time.
-- Self-contained: run after the migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, raw_user_meta_data) values
 ('f0000000-0000-0000-0000-00000000000a','{"full_name":"Hema Owner"}'),
 ('f0000000-0000-0000-0000-00000000000b','{"full_name":"Hari Member"}'),
 ('f0000000-0000-0000-0000-00000000000c','{"full_name":"Hasan Trainer"}'),
 ('f0000000-0000-0000-0000-00000000000d','{"full_name":"Hiba Supervisor"}');
insert into public.brands (id, name) values ('f3000000-0000-0000-0000-000000000001','Hours Gym');
insert into public.gyms (id, name, brand_id, time_zone) values
 ('f1000000-0000-0000-0000-000000000001','Hours Gym','f3000000-0000-0000-0000-000000000001','Asia/Kolkata');
insert into public.gym_members (gym_id, user_id, role) values
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000a','owner'),
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000b','member'),
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000c','trainer'),
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000d','supervisor');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'H1 New branches have no hours (expect null, null)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000b');
select opens_at, closes_at from public.gyms where id = 'f1000000-0000-0000-0000-000000000001';

\echo 'H2 Supervisors and members can''t set hours (expect Only owners change opening hours, twice)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000d');
select public.set_gym_hours('f1000000-0000-0000-0000-000000000001', '06:00', '22:00');
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000b');
select public.set_gym_hours('f1000000-0000-0000-0000-000000000001', '06:00', '22:00');

\echo 'H3 Half-set or equal hours are refused (expect Set both..., can''t be the same)'
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000a');
select public.set_gym_hours('f1000000-0000-0000-0000-000000000001', '06:00', null);
select public.set_gym_hours('f1000000-0000-0000-0000-000000000001', '06:00', '06:00');

\echo 'H4 Nobody updates the columns directly (expect permission denied)'
update public.gyms set closes_at = '23:00' where id = 'f1000000-0000-0000-0000-000000000001';

\echo 'H5 The owner sets 05:00 to 22:00 and the member reads it (expect 05:00:00, 22:00:00)'
select public.set_gym_hours('f1000000-0000-0000-0000-000000000001', '05:00', '22:00');
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000b');
select opens_at, closes_at from public.gyms where id = 'f1000000-0000-0000-0000-000000000001';
reset role;

\echo 'H6 next_closing: before, after and across midnight (expect 22:00 same day, 22:00 next day, 01:00 next day)'
select to_char(public.next_closing('Asia/Kolkata', '22:00', '2026-10-30 18:00+05:30') at time zone 'Asia/Kolkata', 'MM-DD HH24:MI'),
       to_char(public.next_closing('Asia/Kolkata', '22:00', '2026-10-30 22:30+05:30') at time zone 'Asia/Kolkata', 'MM-DD HH24:MI'),
       to_char(public.next_closing('Asia/Kolkata', '01:00', '2026-10-30 20:00+05:30') at time zone 'Asia/Kolkata', 'MM-DD HH24:MI');

-- Hari checked in at 21:00, Hasan at 14:00 the same day; auto check-out runs at 22:10.
-- Hari's 3 hours and Hasan's 12 hours haven't run out, but the gym has closed.
insert into public.attendance (gym_id, user_id, day, role, checked_in_at, last_check_in_at) values
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000b','2026-10-30','member',
  '2026-10-30 21:00+05:30','2026-10-30 21:00+05:30'),
 ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-00000000000c','2026-10-30','trainer',
  '2026-10-30 14:00+05:30','2026-10-30 14:00+05:30');

\echo 'H7 Before closing nobody is checked out (expect 0)'
select public.auto_check_out('2026-10-30 21:50+05:30');

\echo 'H8 After closing both are checked out at 22:00 (expect 2, then Hari 22:00 t, Hasan 22:00 t)'
select public.auto_check_out('2026-10-30 22:10+05:30');
select p.full_name, to_char(a.checked_out_at at time zone 'Asia/Kolkata', 'HH24:MI'), a.auto_checked_out
from public.attendance a join public.profiles p on p.id = a.user_id
where a.gym_id = 'f1000000-0000-0000-0000-000000000001' order by p.full_name;

\echo 'H9 Hours that run out before closing still win (expect 1, then Hari 20:00)'
update public.attendance set checked_out_at = null, auto_checked_out = false,
  checked_in_at = '2026-10-30 17:00+05:30', last_check_in_at = '2026-10-30 17:00+05:30'
where user_id = 'f0000000-0000-0000-0000-00000000000b';
select public.auto_check_out('2026-10-30 20:30+05:30');
select p.full_name, to_char(a.checked_out_at at time zone 'Asia/Kolkata', 'HH24:MI')
from public.attendance a join public.profiles p on p.id = a.user_id
where a.user_id = 'f0000000-0000-0000-0000-00000000000b';

\echo 'H10 Open all day again: only the hours count (expect 0 at 22:10 for a 21:00 check-in)'
set role authenticated;
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000a');
select public.set_gym_hours('f1000000-0000-0000-0000-000000000001', null, null);
reset role;
update public.attendance set checked_out_at = null, auto_checked_out = false,
  checked_in_at = '2026-10-30 21:00+05:30', last_check_in_at = '2026-10-30 21:00+05:30'
where user_id = 'f0000000-0000-0000-0000-00000000000b';
select public.auto_check_out('2026-10-30 22:10+05:30');
