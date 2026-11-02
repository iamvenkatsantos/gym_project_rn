-- Self workouts: a member's trainer lets them plan and run their own workouts.
--
-- A mapped coach switches self workouts on for one of their members
-- (member_trainers.self_workouts). The member then answers a few questions
-- (goal, level, days, split) and the app builds a week of plans from the smart
-- plans; the member can edit them. A self plan is an ordinary workouts row with
-- is_self = true and trainer_id = the member, assigned to that member with its
-- weekdays, so Today / This week from the weekday plans just works.
--
-- The member's trainers see those plans, can edit them, and still assign their
-- own plans as before. After every workout a member answers a short self-check
-- (effort 1-10, any pain, a note) saved on the log; the "finished a workout"
-- push to their trainers carries it, and a trainer can reply once.

-- Who switched it on --------------------------------------------------------------------

alter table public.member_trainers
  add column self_workouts boolean not null default false;

-- True when any of the member's coaches has switched self workouts on.
create function public.self_workouts_on(p_gym_id uuid, p_member_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.member_trainers mt
    where mt.gym_id = p_gym_id and mt.member_id = p_member_id and mt.self_workouts
      and public.is_coach(mt.gym_id, mt.trainer_id)
  )
$$;

revoke execute on function public.self_workouts_on(uuid, uuid) from public, anon;
grant execute on function public.self_workouts_on(uuid, uuid) to authenticated;

-- True when the caller is one of the member's coaches at this gym.
create function public.coaches_member(p_gym_id uuid, p_member_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.member_trainers mt
    where mt.gym_id = p_gym_id and mt.member_id = p_member_id and mt.trainer_id = auth.uid()
      and public.is_coach(mt.gym_id, mt.trainer_id)
  )
$$;

revoke execute on function public.coaches_member(uuid, uuid) from public, anon;
grant execute on function public.coaches_member(uuid, uuid) to authenticated;

-- Notification kind for self workouts and trainer replies. Keep what's allowed and add 'workout'.
do $$
declare
  v_kinds text[];
begin
  select array_agg(distinct k) into v_kinds
  from pg_constraint c,
       regexp_matches(pg_get_constraintdef(c.oid), '''([^'']*)''', 'g') as m,
       regexp_split_to_table(m[1], '[{},[:space:]]+') as k
  where c.conname = 'notifications_kind_check' and c.conrelid = 'public.notifications'::regclass
    and k <> '';
  if not 'workout' = any (coalesce(v_kinds, '{}')) then
    alter table public.notifications drop constraint if exists notifications_kind_check;
    execute format(
      'alter table public.notifications add constraint notifications_kind_check check (kind = any (%L::text[]))',
      array_append(coalesce(v_kinds, '{}'), 'workout'));
  end if;
end;
$$;

-- Only the member's own coaches switch it on or off. Tells the member.
create function public.set_self_workouts(p_gym_id uuid, p_member_id uuid, p_on boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  if not public.coaches_member(p_gym_id, p_member_id) then
    raise exception 'Only this member''s trainers can do this';
  end if;
  update public.member_trainers set self_workouts = coalesce(p_on, false)
    where gym_id = p_gym_id and member_id = p_member_id and trainer_id = auth.uid();
  if p_on then
    select full_name into v_name from public.profiles where id = auth.uid();
    perform public.notify(p_gym_id, p_member_id, 'workout', 'Plan your own workouts',
      coalesce(v_name, 'Your trainer') || ' turned on self workouts. Set up your plan under Workouts.');
  end if;
end;
$$;

revoke execute on function public.set_self_workouts(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_self_workouts(uuid, uuid, boolean) to authenticated;

-- The member's own plans --------------------------------------------------------------

alter table public.workouts add column is_self boolean not null default false;

-- Self plans are seen by the member (as author), their coaches, and owners and supervisors.
create or replace function public.can_view_workout(p_workout_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workouts w
    where w.id = p_workout_id
      and (
        (w.trainer_id = auth.uid() and public.is_gym_member(w.gym_id))
        or public.has_gym_role(w.gym_id, array['supervisor'])
        or (
          not w.is_self and exists (
            select 1 from public.member_trainers mt
            where mt.gym_id = w.gym_id and mt.trainer_id = w.trainer_id
              and mt.member_id = auth.uid()
          )
        )
        or (w.is_self and public.coaches_member(w.gym_id, w.trainer_id))
        or exists (
          select 1 from public.workout_assignments a
          where a.workout_id = w.id and a.member_id = auth.uid()
        )
      )
  )
$$;

-- Coaches see the days of a member's own plans.
create policy "Coaches read members' own plan days" on public.workout_assignments
  for select using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.is_self and w.trainer_id = member_id
        and public.coaches_member(w.gym_id, w.trainer_id)
    )
  );

-- What the member asked for when the plan was built.
create table public.self_workout_prefs (
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  goal text not null check (goal in ('gain_muscle', 'lose_weight', 'stay_fit')),
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  days smallint[] not null
    check (days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[] and cardinality(days) between 3 and 6),
  split text not null check (split in ('full_body', 'split')),
  updated_at timestamptz not null default now(),
  primary key (gym_id, member_id)
);

alter table public.self_workout_prefs enable row level security;

-- Writes go through create_self_plan.
create policy "Read your own or your members' preferences" on public.self_workout_prefs
  for select using (
    member_id = auth.uid()
    or public.coaches_member(gym_id, member_id)
    or public.can_manage_gym(gym_id)
  );

-- Internal: writes one self plan and its days. Callers check who may.
create function public.put_self_workout(
  p_gym_id uuid,
  p_member_id uuid,
  p_workout_id uuid,
  p_title text,
  p_description text,
  p_level text,
  p_duration_minutes int,
  p_exercises jsonb,
  p_days smallint[]
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if coalesce(jsonb_array_length(p_exercises), 0) = 0 then
    raise exception 'Add at least one exercise';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_exercises) e
    where not exists (
      select 1 from public.exercises x
      where x.id = (e ->> 'exercise_id')::uuid and (x.gym_id is null or x.gym_id = p_gym_id)
    )
  ) then
    raise exception 'Pick exercises from the library';
  end if;

  if p_workout_id is null then
    insert into public.workouts
      (gym_id, trainer_id, is_self, title, description, level, duration_minutes)
    values (p_gym_id, p_member_id, true, trim(p_title), coalesce(p_description, ''), p_level,
            p_duration_minutes)
    returning id into v_id;
  else
    update public.workouts
      set title = trim(p_title), description = coalesce(p_description, ''), level = p_level,
          duration_minutes = p_duration_minutes
      where id = p_workout_id and gym_id = p_gym_id and trainer_id = p_member_id and is_self
      returning id into v_id;
    if v_id is null then
      raise exception 'Plan not found';
    end if;
    delete from public.workout_exercises where workout_id = v_id;
  end if;

  insert into public.workout_exercises
    (workout_id, exercise_id, position, sets, reps, target_weight_kg, rest_seconds)
  select v_id, (e ->> 'exercise_id')::uuid, t.ord::int, (e ->> 'sets')::int, (e ->> 'reps')::int,
         (e ->> 'target_weight_kg')::numeric, (e ->> 'rest_seconds')::int
  from jsonb_array_elements(p_exercises) with ordinality as t(e, ord);

  insert into public.workout_assignments (workout_id, member_id, assigned_by, days)
  values (v_id, p_member_id, auth.uid(), coalesce(p_days, '{}'))
  on conflict (workout_id, member_id) do update set days = excluded.days;

  return v_id;
end;
$$;

revoke execute on function public.put_self_workout(uuid, uuid, uuid, text, text, text, int, jsonb, smallint[])
  from public, anon, authenticated;

-- Saves one of a member's own plans: the member while self workouts are on,
-- or any of their coaches (who can always edit it). A coach's edit tells the member.
create function public.save_self_workout(
  p_gym_id uuid,
  p_member_id uuid,
  p_workout_id uuid,
  p_title text,
  p_description text,
  p_level text,
  p_duration_minutes int,
  p_exercises jsonb,
  p_days smallint[]
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_name text;
  v_coach boolean := public.coaches_member(p_gym_id, p_member_id);
begin
  if not (
    v_coach
    or (p_member_id = auth.uid() and public.has_gym_role(p_gym_id, array['member'])
        and public.self_workouts_on(p_gym_id, p_member_id))
  ) then
    raise exception 'Ask your trainer to turn on self workouts';
  end if;
  v_id := public.put_self_workout(p_gym_id, p_member_id, p_workout_id, p_title, p_description,
    p_level, p_duration_minutes, p_exercises, p_days);
  if v_coach and p_member_id <> auth.uid() then
    select full_name into v_name from public.profiles where id = auth.uid();
    perform public.notify(p_gym_id, p_member_id, 'workout', 'Your plan was updated',
      coalesce(v_name, 'Your trainer') || ' updated ' || trim(p_title) || '.');
  end if;
  return v_id;
end;
$$;

revoke execute on function public.save_self_workout(uuid, uuid, uuid, text, text, text, int, jsonb, smallint[])
  from public, anon;
grant execute on function public.save_self_workout(uuid, uuid, uuid, text, text, text, int, jsonb, smallint[])
  to authenticated;

-- Deletes one of a member's own plans (same people as saving).
create function public.delete_self_workout(p_workout_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_gym uuid;
  v_member uuid;
begin
  select gym_id, trainer_id into v_gym, v_member from public.workouts
    where id = p_workout_id and is_self;
  if v_gym is null then
    raise exception 'Plan not found';
  end if;
  if not (
    public.coaches_member(v_gym, v_member)
    or (v_member = auth.uid() and public.self_workouts_on(v_gym, v_member))
  ) then
    raise exception 'Ask your trainer to turn on self workouts';
  end if;
  delete from public.workouts where id = p_workout_id and is_self;
end;
$$;

revoke execute on function public.delete_self_workout(uuid) from public, anon;
grant execute on function public.delete_self_workout(uuid) to authenticated;

-- The member builds (or rebuilds) their week: saves their answers and replaces
-- all their own plans at this gym with p_plans, an array of
-- {title, description, level, duration_minutes, days, exercises}.
create function public.create_self_plan(
  p_gym_id uuid,
  p_goal text,
  p_level text,
  p_days smallint[],
  p_split text,
  p_plans jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_plan jsonb;
begin
  if not (public.has_gym_role(p_gym_id, array['member'])
          and public.self_workouts_on(p_gym_id, auth.uid())) then
    raise exception 'Ask your trainer to turn on self workouts';
  end if;
  if coalesce(jsonb_array_length(p_plans), 0) = 0 then
    raise exception 'Pick your workout days';
  end if;

  insert into public.self_workout_prefs (gym_id, member_id, goal, level, days, split)
  values (p_gym_id, auth.uid(), p_goal, p_level, p_days, p_split)
  on conflict (gym_id, member_id) do update
    set goal = excluded.goal, level = excluded.level, days = excluded.days,
        split = excluded.split, updated_at = now();

  delete from public.workouts
    where gym_id = p_gym_id and trainer_id = auth.uid() and is_self;

  for v_plan in select * from jsonb_array_elements(p_plans) loop
    perform public.put_self_workout(p_gym_id, auth.uid(), null, v_plan ->> 'title',
      v_plan ->> 'description', v_plan ->> 'level', (v_plan ->> 'duration_minutes')::int,
      v_plan -> 'exercises',
      array(select jsonb_array_elements_text(v_plan -> 'days')::smallint));
  end loop;
end;
$$;

revoke execute on function public.create_self_plan(uuid, text, text, smallint[], text, jsonb) from public, anon;
grant execute on function public.create_self_plan(uuid, text, text, smallint[], text, jsonb) to authenticated;

-- Self-check after a workout -------------------------------------------------------------

alter table public.workout_logs
  add column effort smallint check (effort between 1 and 10),
  add column pain text check (length(pain) between 1 and 80),
  add column note text check (length(note) <= 300),
  add column swaps text[] not null default '{}' check (cardinality(swaps) <= 30),
  add column coach_reply text check (length(coach_reply) between 1 and 300),
  -- Plain ids, no FK to profiles: embeds from workout_logs name workout_logs_member_id_fkey.
  add column replied_by uuid,
  add column replied_by_name text,
  add column replied_at timestamptz;

-- Members write their own logs, but only reply_to_workout writes the reply.
create function public.guard_workout_reply() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('corefit.replying', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.coach_reply := null;
    new.replied_by := null;
    new.replied_by_name := null;
    new.replied_at := null;
  else
    new.coach_reply := old.coach_reply;
    new.replied_by := old.replied_by;
    new.replied_by_name := old.replied_by_name;
    new.replied_at := old.replied_at;
  end if;
  return new;
end;
$$;

create trigger workout_logs_guard_reply
  before insert or update on public.workout_logs
  for each row execute function public.guard_workout_reply();

-- A member's coaches (or owners and supervisors) reply to a workout. Tells the member.
-- The log is found by the app's client id, which is how the app knows its logs.
create function public.reply_to_workout(p_client_id uuid, p_reply text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_log public.workout_logs;
  v_name text;
begin
  select * into v_log from public.workout_logs where client_id = p_client_id;
  if v_log.id is null then
    raise exception 'Workout not found';
  end if;
  if not (public.coaches_member(v_log.gym_id, v_log.member_id)
          or public.can_manage_gym(v_log.gym_id)) then
    raise exception 'Only this member''s trainers can reply';
  end if;
  if v_log.member_id = auth.uid() then
    raise exception 'Only this member''s trainers can reply';
  end if;
  if length(trim(coalesce(p_reply, ''))) = 0 then
    raise exception 'Write a reply';
  end if;
  select full_name into v_name from public.profiles where id = auth.uid();
  perform set_config('corefit.replying', 'on', true);
  update public.workout_logs
    set coach_reply = left(trim(p_reply), 300), replied_by = auth.uid(),
        replied_by_name = v_name, replied_at = now()
    where id = v_log.id;
  perform set_config('corefit.replying', 'off', true);
  perform public.notify(v_log.gym_id, v_log.member_id, 'workout',
    left(coalesce(v_name, 'Your trainer') || ' replied', 80),
    v_log.title || ': ' || left(trim(p_reply), 300));
end;
$$;

revoke execute on function public.reply_to_workout(uuid, text) from public, anon;
grant execute on function public.reply_to_workout(uuid, text) to authenticated;

-- The "finished a workout" push now carries the self-check.
create or replace function public.record_workout_attendance() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
  v_minutes int := greatest(1, round(extract(epoch from new.completed_at - new.started_at) / 60));
  v_check text := '';
begin
  if not exists (
    select 1 from public.gym_members
    where gym_id = new.gym_id and user_id = new.member_id and role = 'member' and status = 'active'
  ) then
    return new;
  end if;
  insert into public.attendance (gym_id, user_id, day, role, checked_in_at, checked_out_at, workouts)
  values (new.gym_id, new.member_id, public.gym_day(new.gym_id, new.started_at), 'member',
          new.started_at, new.completed_at, 1)
  on conflict (gym_id, user_id, day) do update
    set workouts = attendance.workouts + 1;

  -- Only worth a push while it's news.
  if new.completed_at > now() - interval '12 hours' then
    if new.effort is not null then
      v_check := v_check || ' Effort ' || new.effort || '/10.';
    end if;
    if new.pain is not null then
      v_check := v_check || ' Pain: ' || new.pain || '.';
    end if;
    if new.note is not null then
      v_check := v_check || ' "' || new.note || '"';
    end if;
    select full_name into v_name from public.profiles where id = new.member_id;
    perform public.tell_member_trainers(new.gym_id, new.member_id,
      coalesce(v_name, 'Your member') || ' finished a workout',
      new.title || ' done at ' || public.gym_time(new.gym_id, new.completed_at, 'FMHH12:MI AM')
        || ' (' || v_minutes || ' min).' || v_check,
      'workout-end:' || new.client_id);
  end if;
  return new;
end;
$$;
