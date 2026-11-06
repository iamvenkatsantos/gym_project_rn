-- Extra notifications: new workout plan, payment received, we miss you, class booking
-- cancelled, monthly measurements, new member joined. Self-contained: run after the
-- migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('e0000000-0000-0000-0000-00000000000a','olga@xn.test',now(),'{"full_name":"Olga Owner"}'),
 ('e0000000-0000-0000-0000-00000000000b','mani@xn.test',now(),'{"full_name":"Mani Member"}'),
 ('e0000000-0000-0000-0000-00000000000c','tejas@xn.test',now(),'{"full_name":"Tejas Trainer"}'),
 ('e0000000-0000-0000-0000-00000000000e','rani@xn.test',now(),'{"full_name":"Rani Member"}');
insert into public.brands (id, name) values ('e3000000-0000-0000-0000-000000000001','XN Gym');
insert into public.gyms (id, name, brand_id, time_zone) values
 ('e1000000-0000-0000-0000-000000000001','XN Gym','e3000000-0000-0000-0000-000000000001','Asia/Kolkata');
update public.gyms set paid_until = current_date + 365 where paid_until is null;
insert into public.gym_members (gym_id, user_id, role, joined_at, onboarded_at) values
 ('e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000a','owner', now() - interval '90 days', null),
 ('e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000b','member', now() - interval '60 days', now()),
 ('e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000c','trainer', now() - interval '90 days', null),
 ('e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000e','member', now() - interval '60 days', null);
insert into public.member_trainers (gym_id, member_id, trainer_id, assigned_by) values
 ('e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000b','e0000000-0000-0000-0000-00000000000c','e0000000-0000-0000-0000-00000000000a');
insert into public.membership_plans (id, gym_id, name, price_cents, duration_days) values
 ('e2000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000001','Monthly',150000,30);

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
create function pg_temp.inbox(u text) returns table (kind text, title text, body text) language sql as $$
  select kind, title, body from public.notifications where recipient_id = u::uuid
    and kind <> 'trainer_assigned' or (recipient_id = u::uuid and title = 'New member joined')
  order by created_at, title
$$;
delete from public.notifications where gym_id = 'e1000000-0000-0000-0000-000000000001';

\echo 'X1 Payment received, with the amount (expect membership | Payment received | ₹1,500 for Monthly. Active until …)'
insert into public.memberships (member_id, plan_id, starts_on, ends_on, amount_paid_cents, payment_method) values
 ('e0000000-0000-0000-0000-00000000000b','e2000000-0000-0000-0000-000000000001', current_date - 20, current_date + 10, 150000, 'upi');
select * from pg_temp.inbox('e0000000-0000-0000-0000-00000000000b');

\echo 'X2 A complimentary membership stays "Membership active" (expect membership | Membership active | Monthly runs until …)'
insert into public.memberships (member_id, plan_id, starts_on, ends_on, amount_paid_cents, payment_method) values
 ('e0000000-0000-0000-0000-00000000000e','e2000000-0000-0000-0000-000000000001', current_date - 20, current_date + 10, 0, 'complimentary');
select * from pg_temp.inbox('e0000000-0000-0000-0000-00000000000e');

\echo 'X3 rupees() uses Indian grouping and drops zero paise (expect ₹1,500 | ₹1,25,000 | ₹99.50)'
select public.rupees(150000), public.rupees(12500000), public.rupees(9950);
delete from public.notifications where gym_id = 'e1000000-0000-0000-0000-000000000001';

\echo 'X4 A coach assigns a plan: the member hears (expect workout | New workout plan | Tejas Trainer gave you Push day. Find it under Workouts.)'
insert into public.workouts (id, gym_id, trainer_id, title, duration_minutes) values
 ('e4000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000c','Push day',45),
 ('e4000000-0000-0000-0000-000000000002','e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000b','My own',45);
update public.workouts set is_self = true where id = 'e4000000-0000-0000-0000-000000000002';
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000c');
insert into public.workout_assignments (workout_id, member_id, assigned_by) values
 ('e4000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000b','e0000000-0000-0000-0000-00000000000c');
select * from pg_temp.inbox('e0000000-0000-0000-0000-00000000000b');

\echo 'X5 A member''s own plan says nothing (expect 1, the same single row)'
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000b');
insert into public.workout_assignments (workout_id, member_id, assigned_by) values
 ('e4000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-00000000000b','e0000000-0000-0000-0000-00000000000b');
select count(*) from public.notifications where recipient_id = 'e0000000-0000-0000-0000-00000000000b';
delete from public.notifications where gym_id = 'e1000000-0000-0000-0000-000000000001';

\echo 'X6 A member drops out of a class: the trainer hears (expect booking | Booking cancelled | Mani Member dropped out of Yoga on … 1 booked.)'
insert into public.classes (id, gym_id, trainer_id, title, starts_at, duration_minutes, capacity) values
 ('e5000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000c','Yoga', now() + interval '2 days', 60, 10);
insert into public.bookings (class_id, member_id) values
 ('e5000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000b'),
 ('e5000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000e');
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000b');
set role authenticated;
update public.bookings set status = 'cancelled'
  where class_id = 'e5000000-0000-0000-0000-000000000001' and member_id = 'e0000000-0000-0000-0000-00000000000b';
reset role;
select * from pg_temp.inbox('e0000000-0000-0000-0000-00000000000c');

\echo 'X7 Cancelling the class tells members, not a second "Booking cancelled" (expect Booking cancelled | Class cancelled)'
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000a');
select public.cancel_class('e5000000-0000-0000-0000-000000000001', false);
select title from public.notifications where recipient_id = 'e0000000-0000-0000-0000-00000000000c'
union all
select title from public.notifications where recipient_id = 'e0000000-0000-0000-0000-00000000000e';
delete from public.notifications where gym_id = 'e1000000-0000-0000-0000-000000000001';

\echo 'X8 Nudges at 9 am send nothing (expect 0)'
insert into public.attendance (gym_id, user_id, day, role, checked_in_at) values
 ('e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000b', current_date - 8, 'member', now() - interval '8 days');
select public.send_member_nudges(((current_date + time '09:00') at time zone 'Asia/Kolkata'));
select count(*) from public.notifications where gym_id = 'e1000000-0000-0000-0000-000000000001';

\echo 'X9 At 10 am: Mani gets We miss you and Time to measure, Tejas gets Member missing; Rani (not onboarded, never came) nothing (expect 3 rows)'
select public.send_member_nudges(((current_date + time '10:30') at time zone 'Asia/Kolkata'));
select p.full_name, n.kind, n.title, n.body from public.notifications n join public.profiles p on p.id = n.recipient_id
  where n.gym_id = 'e1000000-0000-0000-0000-000000000001' order by p.full_name, n.title;

\echo 'X10 Running it again sends nothing new (expect 3)'
select public.send_member_nudges(((current_date + time '15:00') at time zone 'Asia/Kolkata'));
select count(*) from public.notifications where gym_id = 'e1000000-0000-0000-0000-000000000001';
delete from public.notifications where gym_id = 'e1000000-0000-0000-0000-000000000001';

\echo 'X11 Gone 20 days, or measured last week: no nudges (expect 0)'
update public.attendance set day = current_date - 20 where user_id = 'e0000000-0000-0000-0000-00000000000b';
insert into public.body_measurements (gym_id, member_id, measured_on, weight_kg) values
 ('e1000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000b', current_date - 7, 70);
select public.send_member_nudges(((current_date + time '10:30') at time zone 'Asia/Kolkata'));
select count(*) from public.notifications where gym_id = 'e1000000-0000-0000-0000-000000000001';

\echo 'X12 An invited member joins: the owner who invited them hears (expect trainer_assigned | New member joined | Kavi Member joined as a member.)'
insert into public.gym_invites (gym_id, email, role, invited_by) values
 ('e1000000-0000-0000-0000-000000000001','kavi@xn.test','member','e0000000-0000-0000-0000-00000000000a');
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('e0000000-0000-0000-0000-000000000010','kavi@xn.test',now(),'{"full_name":"Kavi Member"}');
select * from pg_temp.inbox('e0000000-0000-0000-0000-00000000000a');

\echo 'X13 A withdrawn invite says nothing (expect 1, still the one row)'
insert into public.gym_invites (gym_id, email, role, invited_by) values
 ('e1000000-0000-0000-0000-000000000001','nobody@xn.test','member','e0000000-0000-0000-0000-00000000000a');
delete from public.gym_invites where email = 'nobody@xn.test';
select count(*) from public.notifications where recipient_id = 'e0000000-0000-0000-0000-00000000000a';

\echo 'X14 A trainer''s invite: only the mapping''s "New member" (expect New member)'
insert into public.gym_invites (gym_id, email, role, invited_by) values
 ('e1000000-0000-0000-0000-000000000001','lata@xn.test','member','e0000000-0000-0000-0000-00000000000c');
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('e0000000-0000-0000-0000-000000000011','lata@xn.test',now(),'{"full_name":"Lata Member"}');
select title from public.notifications where recipient_id = 'e0000000-0000-0000-0000-00000000000c';
