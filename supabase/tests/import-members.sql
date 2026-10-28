-- Importing members from a spreadsheet. Self-contained: run after the
-- migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('f4000000-0000-0000-0000-00000000000a','owner@im.test',now(),'{"full_name":"Iris Owner"}'),
 ('f4000000-0000-0000-0000-00000000000b','sup@im.test',now(),'{"full_name":"Sid Supervisor"}'),
 ('f4000000-0000-0000-0000-00000000000c','coach@im.test',now(),'{"full_name":"Cara Coach"}'),
 ('f4000000-0000-0000-0000-00000000000d','old@im.test',now(),'{"full_name":"Oscar Old"}'),
 ('f4000000-0000-0000-0000-00000000000e','other@im.test',now(),'{"full_name":"Other Owner"}');
-- What the edge function makes for emails without an account: unconfirmed, no name.
insert into auth.users (id, email, raw_user_meta_data) values
 ('f4000000-0000-0000-0000-000000000010','new1@im.test','{}'),
 ('f4000000-0000-0000-0000-000000000011','new2@im.test','{"full_name":"Nina Two"}');
insert into public.brands (id, name) values ('f5000000-0000-0000-0000-000000000001','IM Gym');
insert into public.gyms (id, name, brand_id) values
 ('f6000000-0000-0000-0000-000000000001','IM Gym Velachery','f5000000-0000-0000-0000-000000000001'),
 ('f6000000-0000-0000-0000-000000000002','IM Gym Adyar','f5000000-0000-0000-0000-000000000001');
insert into public.gym_members (gym_id, user_id, role) values
 ('f6000000-0000-0000-0000-000000000001','f4000000-0000-0000-0000-00000000000a','owner'),
 ('f6000000-0000-0000-0000-000000000001','f4000000-0000-0000-0000-00000000000b','supervisor'),
 ('f6000000-0000-0000-0000-000000000001','f4000000-0000-0000-0000-00000000000c','trainer'),
 ('f6000000-0000-0000-0000-000000000001','f4000000-0000-0000-0000-00000000000d','member'),
 ('f6000000-0000-0000-0000-000000000002','f4000000-0000-0000-0000-00000000000e','owner');
insert into public.membership_plans (id, gym_id, name, price_cents, duration_days) values
 ('f7000000-0000-0000-0000-000000000001','f6000000-0000-0000-0000-000000000001','Monthly',150000,30),
 ('f7000000-0000-0000-0000-000000000002','f6000000-0000-0000-0000-000000000002','Yearly',1200000,365);

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'I1 A supervisor can''t import (expect Only owners can import members)'
select pg_temp.as_user('f4000000-0000-0000-0000-00000000000b');
select * from public.import_members('f6000000-0000-0000-0000-000000000001', '[]');

\echo 'I2 Another branch''s owner can''t import here (expect Only owners can import members)'
select pg_temp.as_user('f4000000-0000-0000-0000-00000000000e');
select * from public.import_members('f6000000-0000-0000-0000-000000000001', '[]');

\echo 'I3 The owner imports (expect new1 added not joined, new2 added, old updated joined, coach skipped as trainer, ghost skipped no account, bad plan skipped, Yearly skipped (other branch''s plan), bad dates skipped)'
select pg_temp.as_user('f4000000-0000-0000-0000-00000000000a');
select * from public.import_members('f6000000-0000-0000-0000-000000000001', '[
  {"email":" New1@IM.test ","name":"Nalan One","phone":"98400 11111","plan":"monthly","starts_on":"2026-10-01","amount_paid_cents":150000},
  {"email":"new2@im.test","name":"Overwritten?","phone":"9840022222"},
  {"email":"old@im.test","name":"Oscar Renamed","phone":"9840033333","plan":"Monthly","starts_on":"2026-09-01","ends_on":"2026-09-30","amount_paid_cents":140000,"payment_method":"upi"},
  {"email":"coach@im.test","name":"Cara","phone":"9840044444"},
  {"email":"ghost@im.test","name":"Ghost","phone":"9840055555"},
  {"email":"new1@im.test","plan":"Quarterly","starts_on":"2026-10-01"},
  {"email":"new1@im.test","plan":"Yearly","starts_on":"2026-10-01"},
  {"email":"new1@im.test","plan":"Monthly","starts_on":"2026-10-10","ends_on":"2026-10-01"}
]');

\echo 'I4 What landed (expect Nalan One member admitted by Iris with 9840011111; Nina Two (name kept) with 9840022222; Oscar Old (name kept) with 9840033333)'
select p.full_name, gm.role, gm.status, admitter.full_name as admitted_by, cd.phone
from public.gym_members gm
join public.profiles p on p.id = gm.user_id
left join public.profiles admitter on admitter.id = gm.admitted_by
left join public.contact_details cd on cd.user_id = gm.user_id
where gm.gym_id = 'f6000000-0000-0000-0000-000000000001' and gm.role = 'member'
order by p.full_name;

\echo 'I5 Memberships (expect Nalan 2026-10-01..2026-10-30 150000 cash dated 1 Oct; Oscar 2026-09-01..2026-09-30 140000 upi dated 1 Sep)'
select p.full_name, m.starts_on, m.ends_on, m.amount_paid_cents, m.payment_method, m.note,
       (m.created_at at time zone 'Asia/Kolkata')::date as recorded_on
from public.memberships m join public.profiles p on p.id = m.member_id
where m.plan_id = 'f7000000-0000-0000-0000-000000000001'
order by p.full_name;

\echo 'I6 Importing the same file again adds nothing (expect new1 updated with "Membership was already imported", 2 memberships)'
select * from public.import_members('f6000000-0000-0000-0000-000000000001', '[
  {"email":"new1@im.test","phone":"9999999999","plan":"Monthly","starts_on":"2026-10-01"}
]');
select count(*) from public.memberships where plan_id = 'f7000000-0000-0000-0000-000000000001';

\echo 'I7 A member''s own mobile is kept (expect 9840011111)'
select phone from public.contact_details where user_id = 'f4000000-0000-0000-0000-000000000010';

\echo 'I8 More than 200 rows are refused (expect Import at most 200 rows at a time)'
select * from public.import_members('f6000000-0000-0000-0000-000000000001',
  (select jsonb_agg(jsonb_build_object('email', 'x' || i || '@im.test')) from generate_series(1, 201) i));
reset role;

\echo 'I9 Nalan confirms the invite later and stays a member once (expect 1 row, admitted by Iris)'
set role authenticated;
select pg_temp.as_user('f4000000-0000-0000-0000-00000000000a');
select public.invite_to_gym('f6000000-0000-0000-0000-000000000001', 'new1@im.test', 'member');
reset role;
update auth.users set email_confirmed_at = now() where id = 'f4000000-0000-0000-0000-000000000010';
select count(*), max(admitter.full_name) from public.gym_members gm
left join public.profiles admitter on admitter.id = gm.admitted_by
where gm.user_id = 'f4000000-0000-0000-0000-000000000010';
select count(*) as invites_left from public.gym_invites where email = 'new1@im.test';
