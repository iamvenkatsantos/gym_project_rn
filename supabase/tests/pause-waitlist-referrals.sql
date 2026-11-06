-- Membership pause, class waitlist + booking cap, and referrals. Self-contained: run after
-- the migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
 ('c7000000-0000-0000-0000-00000000000a','owner@pw.test','{"full_name":"Olga Owner"}',now()),
 ('c7000000-0000-0000-0000-00000000000b','pia@pw.test','{"full_name":"Pia Paid"}',now()),
 ('c7000000-0000-0000-0000-00000000000c','raj@pw.test','{"full_name":"Raj Regular"}',now()),
 ('c7000000-0000-0000-0000-00000000000d','sunil@pw.test','{"full_name":"Sunil Supervisor"}',now()),
 ('c7000000-0000-0000-0000-00000000000e','tom@pw.test','{"full_name":"Tom Trainer"}',now()),
 ('c7000000-0000-0000-0000-00000000000f','wendy@pw.test','{"full_name":"Wendy Wait"}',now());
insert into public.brands (id, name) values ('c7300000-0000-0000-0000-000000000001','Pause Gym');
insert into public.gyms (id, name, brand_id, paid_until) values
 ('c7100000-0000-0000-0000-000000000001','Pause Gym','c7300000-0000-0000-0000-000000000001', current_date + 365);
insert into public.gym_members (gym_id, user_id, role) values
 ('c7100000-0000-0000-0000-000000000001','c7000000-0000-0000-0000-00000000000a','owner'),
 ('c7100000-0000-0000-0000-000000000001','c7000000-0000-0000-0000-00000000000b','member'),
 ('c7100000-0000-0000-0000-000000000001','c7000000-0000-0000-0000-00000000000c','member'),
 ('c7100000-0000-0000-0000-000000000001','c7000000-0000-0000-0000-00000000000d','supervisor'),
 ('c7100000-0000-0000-0000-000000000001','c7000000-0000-0000-0000-00000000000e','trainer'),
 ('c7100000-0000-0000-0000-000000000001','c7000000-0000-0000-0000-00000000000f','member');
insert into public.membership_plans (id, gym_id, name, price_cents, duration_days) values
 ('c7200000-0000-0000-0000-000000000001','c7100000-0000-0000-0000-000000000001','Monthly',150000,30);
create function pg_temp.today() returns date language sql as $$ select public.gym_day('c7100000-0000-0000-0000-000000000001') $$;
-- Pia's runs 24 more days and she renewed early; Raj's and Wendy's run a month.
insert into public.memberships (id, member_id, plan_id, starts_on, ends_on) values
 ('c7600000-0000-0000-0000-000000000001','c7000000-0000-0000-0000-00000000000b','c7200000-0000-0000-0000-000000000001',pg_temp.today() - 5, pg_temp.today() + 24),
 ('c7600000-0000-0000-0000-000000000002','c7000000-0000-0000-0000-00000000000b','c7200000-0000-0000-0000-000000000001',pg_temp.today() + 25, pg_temp.today() + 54),
 ('c7600000-0000-0000-0000-000000000003','c7000000-0000-0000-0000-00000000000c','c7200000-0000-0000-0000-000000000001',pg_temp.today() - 1, pg_temp.today() + 28),
 ('c7600000-0000-0000-0000-000000000004','c7000000-0000-0000-0000-00000000000f','c7200000-0000-0000-0000-000000000001',pg_temp.today() - 1, pg_temp.today() + 28);
insert into public.classes (id, gym_id, trainer_id, title, starts_at, duration_minutes, capacity) values
 ('c7400000-0000-0000-0000-000000000001','c7100000-0000-0000-0000-000000000001',
  'c7000000-0000-0000-0000-00000000000e','Spin',now() + interval '2 days',45,1),
 ('c7400000-0000-0000-0000-000000000002','c7100000-0000-0000-0000-000000000001',
  'c7000000-0000-0000-0000-00000000000e','Yoga',now() + interval '3 days',45,10);

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo '--- Pause ---'
\echo 'P1 Pausing is off by default (expect Pausing is off at this gym)'
select pg_temp.as_user('c7000000-0000-0000-0000-00000000000b');
select public.pause_membership('c7100000-0000-0000-0000-000000000001','c7000000-0000-0000-0000-00000000000b', pg_temp.today() + 1, 5);

\echo 'P2 A supervisor can''t change member rules (expect Only owners change member rules)'
select pg_temp.as_user('c7000000-0000-0000-0000-00000000000d');
select public.set_member_rules('c7100000-0000-0000-0000-000000000001', 10, 7, 2);

\echo 'P3 The owner allows 10 pause days, 7 reward days, 2 classes at a time (expect a blank result)'
select pg_temp.as_user('c7000000-0000-0000-0000-00000000000a');
select public.set_member_rules('c7100000-0000-0000-0000-000000000001', 10, 7, 2);

\echo 'P4 Pia books Yoga in 3 days (expect a uuid)'
select pg_temp.as_user('c7000000-0000-0000-0000-00000000000b');
select public.book_class('c7400000-0000-0000-0000-000000000002') is not null as booked;

\echo 'P5 Too many days (expect Only 10 pause days left on this membership)'
select public.pause_membership('c7100000-0000-0000-0000-000000000001','c7000000-0000-0000-0000-00000000000b', pg_temp.today(), 11);

\echo 'P6 A member can''t pause someone else (expect Only owners and supervisors pause someone else''s membership)'
select public.pause_membership('c7100000-0000-0000-0000-000000000001','c7000000-0000-0000-0000-00000000000c', pg_temp.today(), 3);

\echo 'P7 Pia pauses 6 days from today (expect today + 30)'
select public.pause_membership('c7100000-0000-0000-0000-000000000001','c7000000-0000-0000-0000-00000000000b', pg_temp.today(), 6) = pg_temp.today() + 30 as ok;

\echo 'P8 Her renewal moved back 6 days and the Yoga booking was cancelled (expect t, cancelled)'
select (select starts_on = pg_temp.today() + 31 and ends_on = pg_temp.today() + 60
        from public.memberships where id = 'c7600000-0000-0000-0000-000000000002') as moved,
       (select status from public.bookings where class_id = 'c7400000-0000-0000-0000-000000000002' and member_id = 'c7000000-0000-0000-0000-00000000000b');

\echo 'P9 Paused, she can''t check in (expect Your membership is paused. Resume it to continue.)'
select public.check_in('c7100000-0000-0000-0000-000000000001');

\echo 'P10 A second pause is refused (expect A pause is already set. End it first.)'
select public.pause_membership('c7100000-0000-0000-0000-000000000001','c7000000-0000-0000-0000-00000000000b', pg_temp.today() + 10, 2);

\echo 'P11 She sees her pause; Raj doesn''t (expect 1, then 0)'
select count(*) from public.membership_pauses;
select pg_temp.as_user('c7000000-0000-0000-0000-00000000000c');
select count(*) from public.membership_pauses;

\echo 'P12 Pia resumes today: the pause hadn''t passed a day, so it''s gone and all 6 days come back off (expect today + 24, 0 pauses, renewal back at today + 25)'
select pg_temp.as_user('c7000000-0000-0000-0000-00000000000b');
select public.end_pause((select id from public.membership_pauses limit 1)) = pg_temp.today() + 24 as ok;
select count(*) from public.membership_pauses;
select starts_on = pg_temp.today() + 25 as back from public.memberships where id = 'c7600000-0000-0000-0000-000000000002';

\echo 'P13 She can check in again (expect t)'
select (public.check_in('c7100000-0000-0000-0000-000000000001')).day = pg_temp.today() as checked_in;

\echo 'P14 The supervisor pauses Raj from tomorrow for 4 days (expect today + 32, and Raj gets a push)'
select pg_temp.as_user('c7000000-0000-0000-0000-00000000000d');
select public.pause_membership('c7100000-0000-0000-0000-000000000001','c7000000-0000-0000-0000-00000000000c', pg_temp.today() + 1, 4) = pg_temp.today() + 32 as ok;
reset role;
select title from public.notifications where recipient_id = 'c7000000-0000-0000-0000-00000000000c' and kind = 'membership';
set role authenticated;

\echo 'P15 Pausing that starts tomorrow doesn''t stop Raj today (expect t)'
select pg_temp.as_user('c7000000-0000-0000-0000-00000000000c');
select (public.check_in('c7100000-0000-0000-0000-000000000001')).day = pg_temp.today() as checked_in;

\echo 'P16 Raj has used 4 of 10 days; after cancelling the planned pause he could take 10 (expect today + 28, then today + 38)'
select public.end_pause((select id from public.membership_pauses limit 1)) = pg_temp.today() + 28 as ok;
select public.pause_membership('c7100000-0000-0000-0000-000000000001','c7000000-0000-0000-0000-00000000000c', pg_temp.today() + 2, 10) = pg_temp.today() + 38 as ok;

\echo '--- Waitlist ---'
\echo 'W1 Pia books the 1-spot Spin; Wendy joins its waitlist (expect booked, waitlisted)'
select pg_temp.as_user('c7000000-0000-0000-0000-00000000000b');
select public.book_class('c7400000-0000-0000-0000-000000000001') is not null;
select pg_temp.as_user('c7000000-0000-0000-0000-00000000000f');
select public.book_class('c7400000-0000-0000-0000-000000000001') is not null;
select status from public.bookings where member_id = 'c7000000-0000-0000-0000-00000000000f';

\echo 'W2 Wendy is first in line and the schedule counts her (expect 1, then 1 booked 1 waiting)'
select waitlist_position from public.my_waitlist_positions('c7100000-0000-0000-0000-000000000001');
select booked_count, waitlist_count from public.class_schedule where id = 'c7400000-0000-0000-0000-000000000001';

\echo 'W3 Joining twice is refused (expect Already on the waitlist)'
select public.book_class('c7400000-0000-0000-0000-000000000001');

\echo 'W4 The cap: Wendy books Yoga (2 of 2), then a third class is refused (expect t, then You can hold 2 classes at a time...)'
select public.book_class('c7400000-0000-0000-0000-000000000002') is not null;
reset role;
insert into public.classes (id, gym_id, trainer_id, title, starts_at, duration_minutes, capacity) values
 ('c7400000-0000-0000-0000-000000000003','c7100000-0000-0000-0000-000000000001',
  'c7000000-0000-0000-0000-00000000000e','Zumba',now() + interval '4 days',45,10);
set role authenticated;
select public.book_class('c7400000-0000-0000-0000-000000000003');

\echo 'W5 Pia cancels Spin; Wendy moves in and gets a push (expect booked, You''re in)'
select pg_temp.as_user('c7000000-0000-0000-0000-00000000000b');
update public.bookings set status = 'cancelled'
where class_id = 'c7400000-0000-0000-0000-000000000001' and member_id = 'c7000000-0000-0000-0000-00000000000b';
reset role;
select status from public.bookings where class_id = 'c7400000-0000-0000-0000-000000000001' and member_id = 'c7000000-0000-0000-0000-00000000000f';
select title from public.notifications where recipient_id = 'c7000000-0000-0000-0000-00000000000f' and kind = 'booking';

\echo 'W6 Pia rejoins: the class is full again, so she waits (expect waitlisted)'
set role authenticated;
select public.book_class('c7400000-0000-0000-0000-000000000001') is not null;
reset role;
select status from public.bookings where class_id = 'c7400000-0000-0000-0000-000000000001' and member_id = 'c7000000-0000-0000-0000-00000000000b';

\echo 'W7 The owner raises the capacity to 2; Pia moves in (expect booked)'
update public.classes set capacity = 2 where id = 'c7400000-0000-0000-0000-000000000001';
select status from public.bookings where class_id = 'c7400000-0000-0000-0000-000000000001' and member_id = 'c7000000-0000-0000-0000-00000000000b';

\echo 'W8 Cancelling the class clears everyone, waitlist included (expect 0)'
set role authenticated;
select pg_temp.as_user('c7000000-0000-0000-0000-00000000000a');
select public.cancel_class('c7400000-0000-0000-0000-000000000001', false);
reset role;
select count(*) from public.bookings where class_id = 'c7400000-0000-0000-0000-000000000001' and status <> 'cancelled';

\echo '--- Referrals ---'
set role authenticated;
\echo 'R1 Staff can''t refer (expect Only members refer friends)'
select pg_temp.as_user('c7000000-0000-0000-0000-00000000000d');
select public.refer_friend('c7100000-0000-0000-0000-000000000001', 'Kavi Friend', '98400 11111');

\echo 'R2 Pia refers Kavi (expect t), then again (expect The gym is already in touch with them)'
select pg_temp.as_user('c7000000-0000-0000-0000-00000000000b');
select public.refer_friend('c7100000-0000-0000-0000-000000000001', ' Kavi   Friend ', '+91 98400 11111') is not null;
select public.refer_friend('c7100000-0000-0000-0000-000000000001', 'Kavi', '9840011111');

\echo 'R3 Staff can''t fake who referred (expect Referrals come from members)'
select pg_temp.as_user('c7000000-0000-0000-0000-00000000000a');
update public.enquiries set referred_by = 'c7000000-0000-0000-0000-00000000000c' where full_name = 'Kavi Friend';

\echo 'R4 The enquiry is there for the desk, and the owner and supervisor got a push (expect Kavi Friend, 9840011111, referral, Referred by Pia Paid; then 2)'
select full_name, phone, source, interest from public.enquiries where full_name = 'Kavi Friend';
reset role;
select count(*) from public.notifications where title = 'New referral';
set role authenticated;

\echo 'R5 Pia sees it as pending (expect Kavi Friend, pending)'
select pg_temp.as_user('c7000000-0000-0000-0000-00000000000b');
select full_name, status from public.my_referrals('c7100000-0000-0000-0000-000000000001');

\echo 'R6 Kavi joins with that mobile and pays: Pia gets 7 days (expect joined 7 t, Pia''s latest ends today + 61, enquiry joined)'
reset role;
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
 ('c7000000-0000-0000-0000-000000000011','kavi@pw.test','{"full_name":"Kavi Friend"}',now());
insert into public.gym_members (gym_id, user_id, role) values
 ('c7100000-0000-0000-0000-000000000001','c7000000-0000-0000-0000-000000000011','member');
insert into public.contact_details (user_id, phone) values ('c7000000-0000-0000-0000-000000000011','9840011111')
  on conflict (user_id) do update set phone = excluded.phone;
insert into public.memberships (member_id, plan_id, starts_on, ends_on, payment_method, amount_paid_cents) values
 ('c7000000-0000-0000-0000-000000000011','c7200000-0000-0000-0000-000000000001',pg_temp.today(), pg_temp.today() + 29, 'upi', 150000);
set role authenticated;
select pg_temp.as_user('c7000000-0000-0000-0000-00000000000b');
select status, reward_days, reward_applied from public.my_referrals('c7100000-0000-0000-0000-000000000001');
reset role;
select max(ends_on) - pg_temp.today() as days_out from public.memberships where member_id = 'c7000000-0000-0000-0000-00000000000b';
select status from public.enquiries where full_name = 'Kavi Friend';

\echo 'R7 Kavi''s second membership rewards nobody (expect 1 reward row)'
insert into public.memberships (member_id, plan_id, starts_on, ends_on, payment_method) values
 ('c7000000-0000-0000-0000-000000000011','c7200000-0000-0000-0000-000000000001',pg_temp.today() + 30, pg_temp.today() + 59, 'cash');
select count(*) from public.referral_rewards;

\echo 'R8 A referrer with nothing running gets the days on their next membership (expect 36)'
-- Raj's memberships end; he refers Lata, who joins and pays.
delete from public.membership_pauses where member_id = 'c7000000-0000-0000-0000-00000000000c';
update public.memberships set starts_on = pg_temp.today() - 40, ends_on = pg_temp.today() - 10 where member_id = 'c7000000-0000-0000-0000-00000000000c';
set role authenticated;
select pg_temp.as_user('c7000000-0000-0000-0000-00000000000c');
select public.refer_friend('c7100000-0000-0000-0000-000000000001', 'Lata', '9840022222') is not null;
reset role;
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
 ('c7000000-0000-0000-0000-000000000012','lata@pw.test','{"full_name":"Lata"}',now());
insert into public.gym_members (gym_id, user_id, role) values
 ('c7100000-0000-0000-0000-000000000001','c7000000-0000-0000-0000-000000000012','member');
insert into public.contact_details (user_id, phone) values ('c7000000-0000-0000-0000-000000000012','+919840022222')
  on conflict (user_id) do update set phone = excluded.phone;
insert into public.memberships (member_id, plan_id, starts_on, ends_on, payment_method) values
 ('c7000000-0000-0000-0000-000000000012','c7200000-0000-0000-0000-000000000001',pg_temp.today(), pg_temp.today() + 29, 'cash');
insert into public.memberships (member_id, plan_id, starts_on, ends_on, payment_method) values
 ('c7000000-0000-0000-0000-00000000000c','c7200000-0000-0000-0000-000000000001',pg_temp.today(), pg_temp.today() + 29, 'cash');
select max(ends_on) - pg_temp.today() from public.memberships where member_id = 'c7000000-0000-0000-0000-00000000000c';

\echo 'R9 Members can''t read others'' rewards (expect 0)'
set role authenticated;
select pg_temp.as_user('c7000000-0000-0000-0000-00000000000f');
select count(*) from public.referral_rewards;
reset role;
