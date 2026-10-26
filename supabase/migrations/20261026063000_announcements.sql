-- Announcements.
--
-- Owners and supervisors post news to the whole gym, or only to members or only
-- to staff: holidays, timing changes, offers. Each one lands in everyone's inbox
-- it's meant for (so it's pushed like any other notification) and stays on the
-- gym's announcements list.

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  -- Staff is everyone who works at the gym: trainers, supervisors and owners.
  audience text not null default 'everyone' check (audience in ('everyone', 'members', 'staff')),
  title text not null check (length(trim(title)) between 1 and 80),
  body text not null default '' check (length(body) <= 500),
  created_at timestamptz not null default now()
);

create index on public.announcements (gym_id, created_at desc);

alter table public.announcements enable row level security;

-- Whether an announcement for this audience is meant for someone with this role.
create function public.announcement_reaches(p_audience text, p_role text) returns boolean
language sql immutable set search_path = '' as $$
  select p_audience = 'everyone'
    or (p_audience = 'members' and p_role = 'member')
    or (p_audience = 'staff' and p_role <> 'member')
$$;

-- Owners and supervisors see everything their gym posted; others see what's meant for them.
create policy "Read announcements" on public.announcements
  for select using (
    public.can_manage_gym(gym_id)
    or exists (
      select 1 from public.gym_members gm
      where gm.gym_id = announcements.gym_id and gm.user_id = auth.uid() and gm.status = 'active'
        and public.announcement_reaches(announcements.audience, gm.role)
    )
  );

-- Taking one down removes it from the list; inbox copies already sent stay.
create policy "Remove announcements" on public.announcements
  for delete using (public.can_manage_gym(gym_id));

-- Inbox kind. Other migrations may have added kinds too, so keep whatever the
-- check already allows and add 'announcement' to it.
do $$
declare
  v_kinds text[];
begin
  -- The check reads either kind in ('a', 'b') or kind = any ('{a,b}'::text[]).
  select array_agg(distinct k) into v_kinds
  from pg_constraint c,
       regexp_matches(pg_get_constraintdef(c.oid), '''([^'']*)''', 'g') as m,
       regexp_split_to_table(m[1], '[{},[:space:]]+') as k
  where c.conname = 'notifications_kind_check' and c.conrelid = 'public.notifications'::regclass
    and k <> '';
  if not 'announcement' = any (coalesce(v_kinds, '{}')) then
    alter table public.notifications drop constraint if exists notifications_kind_check;
    execute format(
      'alter table public.notifications add constraint notifications_kind_check check (kind = any (%L::text[]))',
      array_append(coalesce(v_kinds, '{}'), 'announcement'));
  end if;
end;
$$;

-- Posts an announcement and puts it in the inbox of every active person it's
-- meant for, except whoever sent it. The inbox rows are what get pushed.
create function public.send_announcement(
  p_gym_id uuid, p_audience text, p_title text, p_body text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_title text := trim(coalesce(p_title, ''));
  v_body text := trim(coalesce(p_body, ''));
begin
  if not public.can_manage_gym(p_gym_id) then
    raise exception 'Only owners and supervisors can send announcements';
  end if;
  if p_audience is null or p_audience not in ('everyone', 'members', 'staff') then
    raise exception 'Pick who it''s for';
  end if;
  if length(v_title) = 0 then
    raise exception 'Add a title';
  end if;
  if length(v_title) > 80 then
    raise exception 'Keep the title under 80 characters';
  end if;
  if length(v_body) > 500 then
    raise exception 'Keep the message under 500 characters';
  end if;

  insert into public.announcements (gym_id, sender_id, audience, title, body)
  values (p_gym_id, auth.uid(), p_audience, v_title, v_body)
  returning id into v_id;

  insert into public.notifications (gym_id, recipient_id, sender_id, kind, title, body, dedupe_key)
  select distinct p_gym_id, gm.user_id, auth.uid(), 'announcement', v_title, v_body, 'announcement:' || v_id
  from public.gym_members gm
  where gm.gym_id = p_gym_id and gm.status = 'active' and gm.user_id <> auth.uid()
    and public.announcement_reaches(p_audience, gm.role)
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

  return v_id;
end;
$$;

revoke execute on function public.send_announcement(uuid, text, text, text) from public, anon;
grant execute on function public.send_announcement(uuid, text, text, text) to authenticated;
