-- Match trainers paging: members to match, no trainer first, chip counts, managers only.
-- Self-contained: run after the migrations. Each step says what to expect.
\set ON_ERROR_STOP 0
begin;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('9b100000-0000-0000-0000-00000000000a','olga@mt.test',now(),'{"full_name":"Olga Owner"}'),
 ('9b100000-0000-0000-0000-00000000000b','mani@mt.test',now(),'{"full_name":"Mani Member"}'),
 ('9b100000-0000-0000-0000-00000000000c','tejas@mt.test',now(),'{"full_name":"Tejas Trainer"}'),
 ('9b100000-0000-0000-0000-00000000000e','rani@mt.test',now(),'{"full_name":"Rani Member"}');
insert into public.brands (id, name) values ('9b500000-0000-0000-0000-000000000001','MT');
insert into public.gyms (id, name, time_zone, brand_id) values
 ('9b200000-0000-0000-0000-000000000001','MT Fitness','Asia/Kolkata','9b500000-0000-0000-0000-000000000001');
update public.gyms set paid_until = current_date + 365 where id = '9b200000-0000-0000-0000-000000000001';
insert into public.gym_members (gym_id, user_id, role) values
 ('9b200000-0000-0000-0000-000000000001','9b100000-0000-0000-0000-00000000000a','owner'),
 ('9b200000-0000-0000-0000-000000000001','9b100000-0000-0000-0000-00000000000b','member'),
 ('9b200000-0000-0000-0000-000000000001','9b100000-0000-0000-0000-00000000000c','trainer'),
 ('9b200000-0000-0000-0000-000000000001','9b100000-0000-0000-0000-00000000000e','member');
-- Rani is active too; Mani gets Tejas as his trainer.
insert into public.member_trainers (gym_id, member_id, trainer_id) values
 ('9b200000-0000-0000-0000-000000000001','9b100000-0000-0000-0000-00000000000b','9b100000-0000-0000-0000-00000000000c');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'MT1 No trainer chip (expect Rani Member | {} | 1 | 1 | 2)'
select pg_temp.as_user('9b100000-0000-0000-0000-00000000000a');
select full_name, trainer_names, total, unmatched_count, members_count
from public.gym_match_members_page('9b200000-0000-0000-0000-000000000001');

\echo 'MT2 All members, no trainer first (expect Rani Member | {} then Mani Member | {Tejas Trainer}, total 2)'
select full_name, trainer_names, total
from public.gym_match_members_page('9b200000-0000-0000-0000-000000000001', false);

\echo 'MT3 Search with nothing found still brings the counts (expect one row: null | 0 | 0 | 0)'
select user_id, total, unmatched_count, members_count
from public.gym_match_members_page('9b200000-0000-0000-0000-000000000001', true, 'nobody');

\echo 'MT4 A trainer is refused (expect ERROR: Only owners and supervisors match trainers)'
select pg_temp.as_user('9b100000-0000-0000-0000-00000000000c');
select * from public.gym_match_members_page('9b200000-0000-0000-0000-000000000001');

reset role;
rollback;
