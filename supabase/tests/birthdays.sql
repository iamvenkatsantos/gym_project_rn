-- Member birthdays: saving a date of birth, who can see and change it, birthday
-- wishes and the managers' morning reminder. Self-contained: run after the
-- migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('b0000000-0000-0000-0000-00000000000a','olga@bd.test',now(),'{"full_name":"Olga Owner"}'),
 ('b0000000-0000-0000-0000-00000000000b','mani@bd.test',now(),'{"full_name":"Mani Member"}'),
 ('b0000000-0000-0000-0000-00000000000c','tejas@bd.test',now(),'{"full_name":"Tejas Trainer"}'),
 ('b0000000-0000-0000-0000-00000000000d','sita@bd.test',now(),'{"full_name":"Sita Supervisor"}'),
 ('b0000000-0000-0000-0000-00000000000e','rani@bd.test',now(),'{"full_name":"Rani Member"}'),
 ('b0000000-0000-0000-0000-00000000000f','oscar@bd.test',now(),'{"full_name":"Oscar Other Owner"}');
insert into public.brands (id, name) values ('b3000000-0000-0000-0000-000000000001','BD Gym');
insert into public.gyms (id, name, brand_id) values
 ('b1000000-0000-0000-0000-000000000001','BD Gym','b3000000-0000-0000-0000-000000000001'),
 ('b1000000-0000-0000-0000-000000000002','Other Gym','b3000000-0000-0000-0000-000000000001');
update public.gyms set paid_until = current_date + 365 where paid_until is null;
insert into public.gym_members (gym_id, user_id, role) values
 ('b1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-00000000000a','owner'),
 ('b1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-00000000000b','member'),
 ('b1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-00000000000c','trainer'),
 ('b1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-00000000000d','supervisor'),
 ('b1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-00000000000e','member'),
 ('b1000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-00000000000f','owner');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'B1 is_birthday: same day, 29 Feb in a non-leap year, another day (expect t | t | f | f)'
select public.is_birthday('1990-10-31', '2026-10-31'),
       public.is_birthday('2000-02-29', '2027-02-28'),
       public.is_birthday('2000-02-29', '2028-02-28'),
       public.is_birthday('1990-10-30', '2026-10-31');

\echo 'B2 A birthday in the future is refused (expect Enter a valid date of birth)'
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select public.save_my_profile('Mani Member', '9876543210', null, current_date + 1);

\echo 'B3 A member saves their profile with a birthday (expect ok)'
select public.save_my_profile('Mani Member', '9876543210', null, '1995-06-15');

\echo 'B4 The older three-argument save keeps the birthday (expect 1995-06-15)'
select public.save_my_profile('Mani M', '9876543210', null);
select date_of_birth from public.contact_details where user_id = 'b0000000-0000-0000-0000-00000000000b';

\echo 'B5 A member can''t set someone else''s birthday (expect Only owners and supervisors can change a member''s birthday)'
select public.set_member_birthday('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000e', '1990-01-01');

\echo 'B6 A trainer can''t either (expect Only owners and supervisors can change a member''s birthday)'
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000c');
select public.set_member_birthday('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000e', '1990-01-01');

\echo 'B7 Another gym''s owner can''t (expect Only owners and supervisors can change a member''s birthday)'
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000f');
select public.set_member_birthday('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000e', '1990-01-01');

\echo 'B8 A supervisor can''t set a trainer''s birthday (expect This member isn''t at your gym)'
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000d');
select public.set_member_birthday('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000c', '1990-01-01');

\echo 'B9 Rani hasn''t given a mobile yet (expect They''ll add it when they first sign in), then has one and the supervisor adds her birthday as today (expect ok)'
select public.set_member_birthday('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000e', '1990-01-01');
reset role;
insert into public.contact_details (user_id, phone) values ('b0000000-0000-0000-0000-00000000000e', '9876500000');
set role authenticated;
select public.set_member_birthday('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000e',
  (public.gym_day('b1000000-0000-0000-0000-000000000001') - interval '30 years')::date);

\echo 'B10 People shows birthdays to managers (expect Mani M 1995-06-15, Rani Member with today 30 years ago)'
select full_name, date_of_birth from public.gym_people('b1000000-0000-0000-0000-000000000001')
  where role = 'member' order by full_name;

\echo 'B11 Wishing Mani on a day that isn''t their birthday (expect It isn''t their birthday today)'
select public.send_birthday_wish('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b');

\echo 'B12 A trainer can''t send wishes (expect Only owners and supervisors can send birthday wishes)'
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000c');
select public.send_birthday_wish('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000e');

\echo 'B13 The supervisor wishes Rani (expect t), then the owner tries again (expect f)'
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000d');
select public.send_birthday_wish('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000e');
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000a');
select public.send_birthday_wish('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000e');

\echo 'B14 Rani has one wish in her inbox (expect 1 | Happy birthday! | Happy birthday, Rani! ... BD Gym.)'
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000e');
select count(*) over (), title, body from public.notifications
  where recipient_id = 'b0000000-0000-0000-0000-00000000000e' and kind = 'birthday';

\echo 'B15 The trainer can''t read Rani''s birthday (not mapped; expect 0 rows)'
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000c');
select date_of_birth from public.contact_details where user_id = 'b0000000-0000-0000-0000-00000000000e';
reset role;

\echo 'B16 Morning reminder at 10 am gym time goes to the owner and supervisor only, once (expect Olga Owner and Sita Supervisor, 1 birthday today, Rani Member)'
select public.send_birthday_reminders(
  (public.gym_day('b1000000-0000-0000-0000-000000000001')::timestamp + interval '10 hours')
    at time zone (select time_zone from public.gyms where id = 'b1000000-0000-0000-0000-000000000001'));
select public.send_birthday_reminders(
  (public.gym_day('b1000000-0000-0000-0000-000000000001')::timestamp + interval '11 hours')
    at time zone (select time_zone from public.gyms where id = 'b1000000-0000-0000-0000-000000000001'));
select p.full_name, n.title, n.body from public.notifications n
  join public.profiles p on p.id = n.recipient_id
  where n.gym_id = 'b1000000-0000-0000-0000-000000000001' and n.dedupe_key like 'birthdays:%'
  order by p.full_name;

\echo 'B17 New-style onboarding needs a date of birth (expect Enter your date of birth)'
set role authenticated;
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select public.complete_member_onboarding('b1000000-0000-0000-0000-000000000001', 'Mani M', '9876543210', 70, 170, null);
reset role;
