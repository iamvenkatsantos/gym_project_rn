-- Member birthdays.
--
-- Members give their date of birth on the first-sign-in form, and anyone can
-- change theirs on Edit profile. Owners and supervisors can add or fix a
-- member's from the person screen (for members who joined before this, or were
-- imported). It lives next to the mobile number in contact_details, so the same
-- people can read it: the person, their gym's managers and their mapped trainers.
--
-- On a member's birthday (the gym's day), owners and supervisors get one
-- morning push listing whose birthday it is, and can send each member a
-- birthday wish: an inbox message and push from the gym, once a year per gym.
-- WhatsApp wishes are sent from the phone and need nothing here.

-- Date of birth ------------------------------------------------------------------------

alter table public.contact_details
  add column date_of_birth date check (date_of_birth >= date '1900-01-01');

-- Not in the future, and at least 5 years old.
create function public.check_birth_date(p_date date) returns void
language plpgsql stable set search_path = '' as $$
begin
  if p_date is not null
     and (p_date < date '1900-01-01' or p_date > (current_date - interval '5 years')::date) then
    raise exception 'Enter a valid date of birth';
  end if;
end;
$$;

-- Whether a day is someone's birthday. 29 Feb birthdays fall on 28 Feb in other years.
create function public.is_birthday(p_dob date, p_day date) returns boolean
language sql immutable set search_path = '' as $$
  select p_dob is not null and (
    to_char(p_dob, 'MM-DD') = to_char(p_day, 'MM-DD')
    or (
      to_char(p_dob, 'MM-DD') = '02-29' and to_char(p_day, 'MM-DD') = '02-28'
      and extract(day from make_date(extract(year from p_day)::int, 3, 1) - 1) = 28
    )
  )
$$;

-- The first-sign-in form gains the date of birth. The older form (installed apps
-- from before this) keeps working without it.
create function public.complete_member_onboarding(
  p_gym_id uuid, p_full_name text, p_phone text, p_weight_kg numeric, p_height_cm numeric,
  p_date_of_birth date
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_date_of_birth is null then
    raise exception 'Enter your date of birth';
  end if;
  perform public.check_birth_date(p_date_of_birth);
  perform public.complete_member_onboarding(
    p_gym_id, p_full_name, p_phone, p_weight_kg, p_height_cm
  );
  update public.contact_details set date_of_birth = p_date_of_birth
    where user_id = auth.uid();
end;
$$;

revoke execute on function public.complete_member_onboarding(uuid, text, text, numeric, numeric, date)
  from public, anon;
grant execute on function public.complete_member_onboarding(uuid, text, text, numeric, numeric, date)
  to authenticated;

-- Edit profile gains the date of birth (null removes it). The three-argument
-- version stays for installed apps and leaves the birthday alone.
create function public.save_my_profile(
  p_full_name text, p_phone text, p_avatar_path text, p_date_of_birth date
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.check_birth_date(p_date_of_birth);
  perform public.save_my_profile(p_full_name, p_phone, p_avatar_path);
  update public.contact_details set date_of_birth = p_date_of_birth
    where user_id = auth.uid();
end;
$$;

revoke execute on function public.save_my_profile(text, text, text, date) from public, anon;
grant execute on function public.save_my_profile(text, text, text, date) to authenticated;

-- Owners and supervisors add or fix a member's date of birth, once the member
-- has a mobile on file (contact_details rows always have one).
create function public.set_member_birthday(
  p_gym_id uuid, p_member_id uuid, p_date_of_birth date
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_gym(p_gym_id) then
    raise exception 'Only owners and supervisors can change a member''s birthday';
  end if;
  if not exists (
    select 1 from public.gym_members
    where gym_id = p_gym_id and user_id = p_member_id and role = 'member'
  ) then
    raise exception 'This member isn''t at your gym';
  end if;
  if p_date_of_birth is null then
    raise exception 'Enter a date of birth';
  end if;
  perform public.check_birth_date(p_date_of_birth);
  -- A member with no row yet hasn't filled in their first-sign-in form, which asks for it.
  update public.contact_details set date_of_birth = p_date_of_birth, updated_at = now()
    where user_id = p_member_id;
  if not found then
    raise exception 'They''ll add it when they first sign in';
  end if;
end;
$$;

revoke execute on function public.set_member_birthday(uuid, uuid, date) from public, anon;
grant execute on function public.set_member_birthday(uuid, uuid, date) to authenticated;

-- People ------------------------------------------------------------------------------

-- The people list gains each person's date of birth.
drop function public.gym_people(uuid);

create function public.gym_people(p_gym_id uuid)
returns table (
  user_id uuid, full_name text, email text, role text, status text, joined_at timestamptz,
  phone text, admitted_by uuid, admitted_by_name text, admitted_at timestamptz,
  onboarded_at timestamptz, avatar_path text, signed_up boolean, date_of_birth date
)
language sql stable security definer set search_path = '' as $$
  select gm.user_id, p.full_name, u.email::text, gm.role, gm.status, gm.joined_at,
         cd.phone, gm.admitted_by, admitter.full_name, gm.admitted_at, gm.onboarded_at,
         p.avatar_path, u.email_confirmed_at is not null, cd.date_of_birth
  from public.gym_members gm
  join public.profiles p on p.id = gm.user_id
  join auth.users u on u.id = gm.user_id
  left join public.contact_details cd on cd.user_id = gm.user_id
  left join public.profiles admitter on admitter.id = gm.admitted_by
  where gm.gym_id = p_gym_id and public.can_manage_gym(p_gym_id)
  order by p.full_name
$$;

revoke execute on function public.gym_people(uuid) from public, anon;
grant execute on function public.gym_people(uuid) to authenticated;

-- Birthday wishes ---------------------------------------------------------------------

-- Inbox kind. Keep whatever the check already allows and add 'birthday'.
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
  if not 'birthday' = any (coalesce(v_kinds, '{}')) then
    alter table public.notifications drop constraint if exists notifications_kind_check;
    execute format(
      'alter table public.notifications add constraint notifications_kind_check check (kind = any (%L::text[]))',
      array_append(coalesce(v_kinds, '{}'), 'birthday'));
  end if;
end;
$$;

-- An owner or supervisor wishes a member on their birthday. One wish per member
-- per gym a year; returns false if someone at the gym already sent it.
create function public.send_birthday_wish(p_gym_id uuid, p_member_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
  v_dob date;
  v_gym text;
  v_today date := public.gym_day(p_gym_id);
  v_first text;
  v_sent int;
begin
  if not public.can_manage_gym(p_gym_id) then
    raise exception 'Only owners and supervisors can send birthday wishes';
  end if;
  select p.full_name, cd.date_of_birth into v_name, v_dob
  from public.gym_members gm
  join public.profiles p on p.id = gm.user_id
  left join public.contact_details cd on cd.user_id = gm.user_id
  where gm.gym_id = p_gym_id and gm.user_id = p_member_id
    and gm.role = 'member' and gm.status = 'active';
  if not found then
    raise exception 'This member isn''t at your gym';
  end if;
  if not public.is_birthday(v_dob, v_today) then
    raise exception 'It isn''t their birthday today';
  end if;
  select name into v_gym from public.gyms where id = p_gym_id;
  v_first := coalesce(nullif(split_part(trim(coalesce(v_name, '')), ' ', 1), ''), 'there');

  insert into public.notifications (gym_id, recipient_id, sender_id, kind, title, body, dedupe_key)
  values (p_gym_id, p_member_id, auth.uid(), 'birthday', 'Happy birthday!',
          left('Happy birthday, ' || v_first || '! Wishing you a great year ahead from all of us at '
            || v_gym || '.', 500),
          'birthday:' || p_gym_id || ':' || extract(year from v_today))
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_sent = row_count;
  return v_sent > 0;
end;
$$;

revoke execute on function public.send_birthday_wish(uuid, uuid) from public, anon;
grant execute on function public.send_birthday_wish(uuid, uuid) to authenticated;

-- Owners and supervisors, from 9 am gym time on a day with member birthdays:
-- how many, and whose. Once a day per gym.
create function public.send_birthday_reminders(p_now timestamptz default now()) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (gym_id, recipient_id, kind, title, body, dedupe_key)
  select b.gym_id, gm.user_id, 'birthday',
         case when b.total = 1 then '1 birthday today' else b.total || ' birthdays today' end,
         b.names
           || case when b.total > 3 then ' and ' || (b.total - 3) || ' more' else '' end
           || '. Send them a wish from Birthdays.',
         'birthdays:' || b.gym_id || ':' || b.today
  from (
    select m.gym_id, m.today, count(*)::int as total,
           string_agg(m.full_name, ', ' order by m.full_name) filter (where m.rank <= 3) as names
    from (
      select gm.gym_id, (p_now at time zone g.time_zone)::date as today,
             coalesce(nullif(p.full_name, ''), 'A member') as full_name,
             row_number() over (partition by gm.gym_id order by p.full_name, gm.user_id) as rank
      from public.gym_members gm
      join public.gyms g on g.id = gm.gym_id
      join public.contact_details cd on cd.user_id = gm.user_id
      join public.profiles p on p.id = gm.user_id
      where gm.role = 'member' and gm.status = 'active'
        and public.is_birthday(cd.date_of_birth, (p_now at time zone g.time_zone)::date)
        and extract(hour from p_now at time zone g.time_zone) >= 9
    ) m
    group by m.gym_id, m.today
  ) b
  join public.gym_members gm
    on gm.gym_id = b.gym_id and gm.role in ('owner', 'supervisor') and gm.status = 'active'
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
end;
$$;

revoke execute on function public.send_birthday_reminders(timestamptz)
  from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('corefit-birthdays', '5 * * * *', 'select public.send_birthday_reminders()');
  end if;
end;
$$;
