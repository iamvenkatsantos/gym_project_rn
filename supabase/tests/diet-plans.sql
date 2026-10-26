-- Diet plan checks. Self-contained: run after the migrations (rls.sql is optional).
-- Each step says what to expect; the "expect error" steps must print that error.
\set ON_ERROR_STOP 0
insert into auth.users (id, raw_user_meta_data) values
 ('d0000000-0000-0000-0000-00000000000a','{"full_name":"Dina Owner"}'),
 ('d0000000-0000-0000-0000-00000000000b','{"full_name":"Tara Trainer"}'),
 ('d0000000-0000-0000-0000-00000000000c','{"full_name":"Ravi Member"}'),
 ('d0000000-0000-0000-0000-00000000000d','{"full_name":"Sana Member"}'),
 ('d0000000-0000-0000-0000-00000000000e','{"full_name":"Kiran Trainer"}'),
 ('d0000000-0000-0000-0000-00000000000f','{"full_name":"Omar Outsider"}');
insert into public.gyms (id, name) values
 ('d1000000-0000-0000-0000-000000000001','Diet Gym'),
 ('d1000000-0000-0000-0000-000000000002','Elsewhere Gym');
insert into public.gym_members (gym_id, user_id, role) values
 ('d1000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000a','owner'),
 ('d1000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000b','trainer'),
 ('d1000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000c','member'),
 ('d1000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000d','member'),
 ('d1000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000e','trainer'),
 ('d1000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-00000000000f','owner');
insert into public.member_trainers (gym_id, member_id, trainer_id) values
 ('d1000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000c','d0000000-0000-0000-0000-00000000000b');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
set role authenticated;

\echo 'D1 Tara saves a plan with two meals (expect ok, 2 meals)'
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000b');
select public.save_meal_plan('d1000000-0000-0000-0000-000000000001', null, ' Lean bulk ', 'Drink 3 L water', 'veg', 2400, 140, 280, 70,
  '[{"name":"Breakfast","time_label":"7:30 AM","foods":"Oats, banana, milk","calories":550},
    {"name":"Lunch","time_label":"","foods":"Rice, dal, paneer","calories":null}]') is not null as ok;
select title, food_type, (select count(*) from public.meal_plan_meals m where m.plan_id = p.id) as meals from public.meal_plans p;

\echo 'D2 a plan with no meals (expect Add at least one meal), a bad food type (expect check violation)'
select public.save_meal_plan('d1000000-0000-0000-0000-000000000001', null, 'Empty', '', 'veg', null, null, null, null, '[]');
select public.save_meal_plan('d1000000-0000-0000-0000-000000000001', null, 'Odd', '', 'keto', null, null, null, null, '[{"name":"Lunch","foods":"x"}]');

\echo 'D3 Ravi cannot read the plan before it is assigned (expect 0), Sana and Omar cannot write one (expect row-level security x2)'
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000c');
select count(*) as ravi_sees from public.meal_plans;
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
select public.save_meal_plan('d1000000-0000-0000-0000-000000000001', null, 'Member plan', '', 'veg', null, null, null, null, '[{"name":"Lunch","foods":"x"}]');
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000f');
select public.save_meal_plan('d1000000-0000-0000-0000-000000000001', null, 'Outsider plan', '', 'veg', null, null, null, null, '[{"name":"Lunch","foods":"x"}]');

\echo 'D4 Tara assigns it to Ravi (expect ok), not to unmapped Sana (expect Pick a member)'
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000b');
select public.assign_meal_plan((select id from public.meal_plans where title = 'Lean bulk'), 'd0000000-0000-0000-0000-00000000000c');
select public.assign_meal_plan((select id from public.meal_plans where title = 'Lean bulk'), 'd0000000-0000-0000-0000-00000000000d');

\echo 'D5 Ravi sees his plan and both meals (expect 1, 2) and one "New diet plan" notification'
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000c');
select count(*) as plans from public.meal_plans;
select count(*) as meals from public.meal_plan_meals;
select title from public.notifications where kind = 'trainer_assigned' and title = 'New diet plan';

\echo 'D6 assigning the same plan again sends no second notification (expect 1)'
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000b');
select public.assign_meal_plan((select id from public.meal_plans where title = 'Lean bulk'), 'd0000000-0000-0000-0000-00000000000c');
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000c');
select count(*) as notes from public.notifications where title = 'New diet plan';

\echo 'D7 Ravi cannot edit or assign the plan (expect UPDATE 0, Plan not found)'
update public.meal_plans set title = 'Mine now';
select public.assign_meal_plan((select id from public.meal_plans where title = 'Lean bulk'), 'd0000000-0000-0000-0000-00000000000c');

\echo 'D8 Kiran (other trainer) cannot see or edit Tara''s plan (expect 0, UPDATE 0)'
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000e');
select count(*) as kiran_sees from public.meal_plans;
update public.meal_plans set title = 'Kiran edit';

\echo 'D9 Dina (owner) sees it and Ravi''s assignment (expect 1, 1), and can edit it (expect ok)'
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000a');
select count(*) as owner_sees from public.meal_plans;
select count(*) as owner_assignments from public.meal_plan_assignments;
select public.save_meal_plan('d1000000-0000-0000-0000-000000000001', (select id from public.meal_plans where title = 'Lean bulk'), 'Lean bulk', '', 'egg', 2500, 150, 280, 70,
  '[{"name":"Breakfast","foods":"Eggs, toast"}]') is not null as ok;

\echo 'D10 Dina maps Sana to herself, writes her own plan and assigns it (expect ok); a second plan for Sana replaces it (expect 1 row, Plan B)'
insert into public.member_trainers (gym_id, member_id, trainer_id) values
 ('d1000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000d','d0000000-0000-0000-0000-00000000000a');
select public.save_meal_plan('d1000000-0000-0000-0000-000000000001', null, 'Plan A', '', 'vegan', null, null, null, null, '[{"name":"Lunch","foods":"Tofu"}]') is not null as ok;
select public.save_meal_plan('d1000000-0000-0000-0000-000000000001', null, 'Plan B', '', 'non_veg', null, null, null, null, '[{"name":"Lunch","foods":"Chicken"}]') is not null as ok;
select public.assign_meal_plan((select id from public.meal_plans where title = 'Plan A'), 'd0000000-0000-0000-0000-00000000000d');
select public.assign_meal_plan((select id from public.meal_plans where title = 'Plan B'), 'd0000000-0000-0000-0000-00000000000d');
select p.title from public.meal_plan_assignments a join public.meal_plans p on p.id = a.plan_id
  where a.member_id = 'd0000000-0000-0000-0000-00000000000d';

\echo 'D11 Tara cannot unassign Dina''s plan (expect Plan not found); unmapping Ravi from Tara takes his plan off (expect 0)'
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000b');
select public.unassign_meal_plan((select id from public.meal_plans where title = 'Plan B'), 'd0000000-0000-0000-0000-00000000000d');
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000a');
delete from public.member_trainers where member_id = 'd0000000-0000-0000-0000-00000000000c';
select count(*) as ravi_assignments from public.meal_plan_assignments where member_id = 'd0000000-0000-0000-0000-00000000000c';

\echo 'D12 Dina unassigns Plan B from Sana (expect 0 left); coach_id cannot be changed (expect permission denied)'
select public.unassign_meal_plan((select id from public.meal_plans where title = 'Plan B'), 'd0000000-0000-0000-0000-00000000000d');
select count(*) as sana_assignments from public.meal_plan_assignments where member_id = 'd0000000-0000-0000-0000-00000000000d';
update public.meal_plans set coach_id = 'd0000000-0000-0000-0000-00000000000e';

\echo 'D13 Omar (owner of another gym) sees none of it (expect 0, 0)'
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000f');
select count(*) as omar_plans from public.meal_plans;
select count(*) as omar_meals from public.meal_plan_meals;
reset role;
