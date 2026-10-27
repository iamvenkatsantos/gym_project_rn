-- QR check-in: poster and live codes, scanning in and out, QR-only branches and
-- auto check-out. Self-contained: run after the migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, raw_user_meta_data) values
 ('e0000000-0000-0000-0000-00000000000a','{"full_name":"Olivia Owner"}'),
 ('e0000000-0000-0000-0000-00000000000b','{"full_name":"Manoj Member"}'),
 ('e0000000-0000-0000-0000-00000000000c','{"full_name":"Tara Trainer"}'),
 ('e0000000-0000-0000-0000-00000000000d','{"full_name":"Sam Supervisor"}'),
 ('e0000000-0000-0000-0000-00000000000e','{"full_name":"Oscar Outsider"}');
insert into public.brands (id, name) values
 ('e3000000-0000-0000-0000-000000000001','QR Gym'),
 ('e3000000-0000-0000-0000-000000000002','Other QR Gym');
insert into public.gyms (id, name, brand_id) values
 ('e1000000-0000-0000-0000-000000000001','QR Gym Velachery','e3000000-0000-0000-0000-000000000001'),
 ('e1000000-0000-0000-0000-000000000002','QR Gym Adyar','e3000000-0000-0000-0000-000000000001'),
 ('e1000000-0000-0000-0000-000000000003','Other QR Gym','e3000000-0000-0000-0000-000000000002');
insert into public.gym_members (gym_id, user_id, role) values
 ('e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000a','owner'),
 ('e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000b','member'),
 ('e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000c','trainer'),
 ('e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000d','supervisor'),
 ('e1000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-00000000000e','member');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
-- The code the front-desk screen shows now, or n windows ago.
create function pg_temp.live(n int default 0) returns text language sql as $$
  select public.live_check_in_code(c.display_key, c.gym_id, public.check_in_window(now()) - n)
  from public.gym_check_in_codes c where c.gym_id = 'e1000000-0000-0000-0000-000000000001'
$$;
create function pg_temp.poster() returns text language sql as $$
  select poster_code from public.gym_check_in_codes where gym_id = 'e1000000-0000-0000-0000-000000000001'
$$;
set role authenticated;

\echo 'Q1 Members can''t read the QR settings (expect Only owners and supervisors see the check-in QR)'
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000b');
select * from public.check_in_qr('e1000000-0000-0000-0000-000000000001');

\echo 'Q2 The supervisor reads them; codes are made on first read (expect QR Gym Velachery, 20, t, 32, f, 3, 12)'
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000d');
select gym_name, length(poster_code), poster_enabled, length(display_key), qr_only,
       member_auto_out_hours, trainer_auto_out_hours
from public.check_in_qr('e1000000-0000-0000-0000-000000000001');

\echo 'Q3 Nobody reads the codes table directly (expect permission denied)'
select count(*) from public.gym_check_in_codes;

\echo 'Q4 The supervisor can''t change settings (expect Only owners change check-in settings)'
select public.set_check_in_settings('e1000000-0000-0000-0000-000000000001', true, true, 3, 12);

reset role;

-- The codes as the front desk shows them; read as the table owner.
select pg_temp.live() as live_now, pg_temp.live(2) as live_old, pg_temp.live(3) as live_expired,
       pg_temp.poster() as poster \gset
select display_key from public.gym_check_in_codes
where gym_id = 'e1000000-0000-0000-0000-000000000001' \gset

\echo 'Q5 The display shows the current code (expect QR Gym Velachery, t, t)'
set role authenticated;
select d.gym_name, d.code = :'live_now' as current, d.refresh_at > now() as later
from public.check_in_display(:'display_key') d;
\echo 'Q6 A wrong display key is refused (expect This display link no longer works)'
select * from public.check_in_display('nope');
reset role;

set role authenticated;

\echo 'Q7 Oscar from another brand can''t scan in (expect You aren''t a member of QR Gym Velachery)'
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
select * from public.scan_check_in('e1000000-0000-0000-0000-000000000001', :'live_now');

\echo 'Q8 Manoj scanning the Adyar branch is sent home (expect This QR is for QR Gym Adyar. Check in at QR Gym Velachery.)'
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000b');
select * from public.scan_check_in('e1000000-0000-0000-0000-000000000002', :'live_now');

\echo 'Q9 A code from 90+ seconds ago is refused (expect This QR has expired)'
select * from public.scan_check_in('e1000000-0000-0000-0000-000000000001', :'live_expired');

\echo 'Q10 A made-up code is refused (expect This QR has expired)'
select * from public.scan_check_in('e1000000-0000-0000-0000-000000000001', '123.abcdefabcdef');

\echo 'Q11 Manoj scans a 60-second-old live code and is in (expect in, t, t)'
select action, checked_in_at is not null, checked_out_at is null
from public.scan_check_in('e1000000-0000-0000-0000-000000000001', :'live_old');

\echo 'Q12 Scanning again straight away changes nothing (expect already_in, t)'
select action, checked_out_at is null
from public.scan_check_in('e1000000-0000-0000-0000-000000000001', :'live_now');

reset role;
update public.attendance set checked_in_at = now() - interval '1 hour', last_check_in_at = now() - interval '1 hour'
where user_id = 'e0000000-0000-0000-0000-00000000000b';
set role authenticated;
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000b');

\echo 'Q13 An hour later the poster checks him out (expect out, t)'
select action, checked_out_at is not null
from public.scan_check_in('e1000000-0000-0000-0000-000000000001', :'poster');

\echo 'Q14 Scanning again checks him back in, keeping the first arrival (expect in, t, t)'
select action, checked_out_at is null, checked_in_at < now() - interval '50 minutes'
from public.scan_check_in('e1000000-0000-0000-0000-000000000001', :'poster');

\echo 'Q15 The owner can''t check in by scanning (expect Owners and supervisors don''t check in)'
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000a');
select * from public.scan_check_in('e1000000-0000-0000-0000-000000000001', :'live_now');

\echo 'Q16 The owner makes it QR only and switches the poster off (expect t, f, 2, 10)'
select public.set_check_in_settings('e1000000-0000-0000-0000-000000000001', true, false, 2, 10);
select qr_only, poster_enabled, member_auto_out_hours, trainer_auto_out_hours
from public.check_in_qr('e1000000-0000-0000-0000-000000000001');

\echo 'Q17 Out-of-range hours are refused (expect Members are checked out after 1 to 12 hours)'
select public.set_check_in_settings('e1000000-0000-0000-0000-000000000001', true, false, 0, 10);

\echo 'Q18 Members read the QR-only switch but not the secrets (expect t, then permission denied)'
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000c');
select qr_check_in_only from public.gyms where id = 'e1000000-0000-0000-0000-000000000001';
select poster_code from public.gym_check_in_codes;

\echo 'Q19 Tara can''t use the Home button on a QR-only branch (expect Scan the QR at the front desk)'
select public.check_in('e1000000-0000-0000-0000-000000000001');

\echo 'Q20 The switched-off poster no longer works (expect This QR has expired)'
select * from public.scan_check_in('e1000000-0000-0000-0000-000000000001', :'poster');

\echo 'Q21 The live code still does (expect in)'
select action from public.scan_check_in('e1000000-0000-0000-0000-000000000001', :'live_now');

\echo 'Q22 Checking out with the button still works on a QR-only branch (expect t)'
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000b');
select (public.check_out('e1000000-0000-0000-0000-000000000001')).checked_out_at is not null;

\echo 'Q23 Resetting the display link stops the old one (expect This display link no longer works)'
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000a');
select public.reset_check_in_code('e1000000-0000-0000-0000-000000000001', 'display');
reset role;
set role authenticated;
select * from public.check_in_display(:'live_now');
reset role;

\echo 'Q24 ...and old live codes (expect f)'
select public.valid_check_in_code('e1000000-0000-0000-0000-000000000001', :'live_now');

\echo 'Q25 Nobody can run auto check-out themselves (expect permission denied)'
set role authenticated;
select public.auto_check_out();
reset role;

\echo 'Q26 Auto check-out: Tara (in 11 h, limit 10) and Manoj (in 3 h, limit 2, workout ended 1 h in) (expect 2, then 10:00 t and 01:00 t)'
update public.attendance set checked_out_at = null, auto_checked_out = false,
  checked_in_at = now() - interval '3 hours', last_check_in_at = now() - interval '3 hours'
where user_id = 'e0000000-0000-0000-0000-00000000000b';
update public.attendance set checked_in_at = now() - interval '11 hours', last_check_in_at = now() - interval '11 hours'
where user_id = 'e0000000-0000-0000-0000-00000000000c';
insert into public.workout_logs (gym_id, member_id, title, started_at, completed_at, client_id)
values ('e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000b', 'Legs',
        now() - interval '170 minutes', now() - interval '2 hours', gen_random_uuid());
select public.auto_check_out();
select p.full_name, to_char(a.checked_out_at - coalesce(a.last_check_in_at, a.checked_in_at), 'HH24:MI'),
       a.auto_checked_out
from public.attendance a join public.profiles p on p.id = a.user_id
where a.gym_id = 'e1000000-0000-0000-0000-000000000001' order by p.full_name;

\echo 'Q27 Running it again finds nobody (expect 0)'
select public.auto_check_out();

\echo 'Q28 The day list shows the auto check-outs (expect Manoj t, Tara t)'
set role authenticated;
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000d');
select full_name, auto_checked_out from public.gym_attendance('e1000000-0000-0000-0000-000000000001')
where checked_in_at is not null order by full_name;
reset role;

-- The admin hands out each branch's printed QR.
insert into auth.users (id, raw_user_meta_data) values
 ('e0000000-0000-0000-0000-00000000000f','{"full_name":"Asha Admin"}');
insert into public.platform_admins (user_id) values ('e0000000-0000-0000-0000-00000000000f');
set role authenticated;

\echo 'Q29 The owner can''t use the admin QR functions (expect Only CoreFit Gym admins, twice)'
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000a');
select * from public.admin_check_in_qr('e1000000-0000-0000-0000-000000000001');
select public.admin_reset_check_in_qr('e1000000-0000-0000-0000-000000000001');

\echo 'Q30 The admin reads Adyar''s QR, made on first read (expect QR Gym Adyar, 20, t)'
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000f');
select gym_name, length(poster_code), poster_enabled
from public.admin_check_in_qr('e1000000-0000-0000-0000-000000000002');

\echo 'Q31 Resetting Velachery''s QR gives a new code and switches it back on (expect t, t)'
select poster_code as old_code from public.admin_check_in_qr('e1000000-0000-0000-0000-000000000001') \gset
select public.admin_reset_check_in_qr('e1000000-0000-0000-0000-000000000001');
select poster_code <> :'old_code', poster_enabled
from public.admin_check_in_qr('e1000000-0000-0000-0000-000000000001');
reset role;

\echo 'Q32 The display link no longer works signed out (expect permission denied)'
set role anon;
select * from public.check_in_display(:'display_key');
reset role;
