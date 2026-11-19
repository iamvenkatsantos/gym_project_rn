-- People paging (2026-11-17): gym_people_page / gym_people_counts return exactly what
-- gym_people does, filtered, searched and paged. Self-contained: run after the migrations.
-- Every check prints ok or FAIL.
\set ON_ERROR_STOP 0
\set ON_ERROR_ROLLBACK on
begin;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('f1000000-0000-0000-0000-00000000000a','owner@pg.test',now(),'{"full_name":"Pg Owner"}'),
 ('f1000000-0000-0000-0000-00000000000b','sup@pg.test',now(),'{"full_name":"Pg Sup"}'),
 ('f1000000-0000-0000-0000-00000000000c','trainer@pg.test',now(),'{"full_name":"Pg Trainer"}'),
 ('f1000000-0000-0000-0000-00000000000d','other@pg.test',now(),'{"full_name":"Other Owner"}');
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select ('f2000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       case when n = 7 then '100%_sure@pg.test' else 'm' || n || '@pg.test' end,
       now(), jsonb_build_object('full_name', case when n = 7 then 'Pct 100%_Sure' else 'Member ' || lpad(n::text, 3, '0') end)
from generate_series(1, 120) n;
insert into public.brands (id, name) values ('f1200000-0000-0000-0000-000000000001','PG'),('f1200000-0000-0000-0000-000000000002','PG2');
insert into public.gyms (id, name, brand_id, paid_until) values
 ('f1300000-0000-0000-0000-00000000000a','PG Gym','f1200000-0000-0000-0000-000000000001', current_date + 300),
 ('f1300000-0000-0000-0000-00000000000b','PG Other','f1200000-0000-0000-0000-000000000002', current_date + 300);
insert into public.gym_members (gym_id, user_id, role) values
 ('f1300000-0000-0000-0000-00000000000a','f1000000-0000-0000-0000-00000000000a','owner'),
 ('f1300000-0000-0000-0000-00000000000a','f1000000-0000-0000-0000-00000000000b','supervisor'),
 ('f1300000-0000-0000-0000-00000000000a','f1000000-0000-0000-0000-00000000000c','trainer'),
 ('f1300000-0000-0000-0000-00000000000b','f1000000-0000-0000-0000-00000000000d','owner');
insert into public.gym_members (gym_id, user_id, role)
select 'f1300000-0000-0000-0000-00000000000a', ('f2000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'member'
from generate_series(1, 120) n;
update public.gym_members set status = 'suspended'
where gym_id = 'f1300000-0000-0000-0000-00000000000a' and user_id in
  ('f2000000-0000-0000-0000-000000000003','f2000000-0000-0000-0000-000000000004');
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;
select pg_temp.as_user('f1000000-0000-0000-0000-00000000000a');

\echo 'P1 all pages joined = gym_people, same order (expect ok)'
select case when (select array_agg(user_id order by o) from (
        select user_id, row_number() over () o from (
          select * from public.gym_people_page('f1300000-0000-0000-0000-00000000000a','all','',50,0)
          union all select * from public.gym_people_page('f1300000-0000-0000-0000-00000000000a','all','',50,50)
          union all select * from public.gym_people_page('f1300000-0000-0000-0000-00000000000a','all','',50,100)) s) x)
      = (select array_agg(user_id) from public.gym_people('f1300000-0000-0000-0000-00000000000a'))
  then 'ok' else 'FAIL' end;

\echo 'P2 total on a page = everyone (expect ok)'
select case when (select max(total) from public.gym_people_page('f1300000-0000-0000-0000-00000000000a','all','',10,0)) = 123 then 'ok' else 'FAIL' end;

\echo 'P3 filter member excludes suspended, matches the app rule (expect ok)'
select case when (select max(total) from public.gym_people_page('f1300000-0000-0000-0000-00000000000a','member','',10,0)) = 118 then 'ok' else 'FAIL' end;
\echo 'P4 filter suspended (expect ok)'
select case when (select count(*) from public.gym_people_page('f1300000-0000-0000-0000-00000000000a','suspended','',10,0)) = 2 then 'ok' else 'FAIL' end;

\echo 'P5 counts (expect 123 | 118 | 1 | 1 | 1 | 2)'
select everyone, members, trainers, supervisors, owners, suspended from public.gym_people_counts('f1300000-0000-0000-0000-00000000000a');

\echo 'P6 search by name, case-insensitive (expect 1)'
select count(*) from public.gym_people_page('f1300000-0000-0000-0000-00000000000a','all','mEmBeR 042',10,0);
\echo 'P7 search by email (expect 1)'
select count(*) from public.gym_people_page('f1300000-0000-0000-0000-00000000000a','all','sup@pg',10,0);
\echo 'P8 % and _ are literal (expect 1, then 0)'
select count(*) from public.gym_people_page('f1300000-0000-0000-0000-00000000000a','all','100%_sure',10,0);
select count(*) from public.gym_people_page('f1300000-0000-0000-0000-00000000000a','all','%',10,0) where full_name not like '%\%%';

\echo 'P9 bad filter and bad page are refused (expect two errors)'
select * from public.gym_people_page('f1300000-0000-0000-0000-00000000000a','nope','',10,0);
select * from public.gym_people_page('f1300000-0000-0000-0000-00000000000a','all','',0,0);

\echo 'P10 a trainer gets nothing, like gym_people (expect 0 | 0)'
select pg_temp.as_user('f1000000-0000-0000-0000-00000000000c');
select count(*) from public.gym_people_page('f1300000-0000-0000-0000-00000000000a','all','',50,0);
select everyone from public.gym_people_counts('f1300000-0000-0000-0000-00000000000a');

\echo 'P11 another gym''s owner gets nothing (expect 0)'
select pg_temp.as_user('f1000000-0000-0000-0000-00000000000d');
select count(*) from public.gym_people_page('f1300000-0000-0000-0000-00000000000a','all','',50,0);

\echo 'P12 anon cannot call it (expect permission denied)'
reset role; set role anon;
select * from public.gym_people_page('f1300000-0000-0000-0000-00000000000a','all','',50,0);
rollback;
