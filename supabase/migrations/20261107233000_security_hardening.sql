-- Security hardening (Venkat, 2026-11-08), from the Supabase Security Advisor and a review of
-- the API. Nothing here deletes data.
--
--   1. class_schedule runs as the caller (security_invoker), so the caller's RLS applies. The
--      advisor flagged it as a SECURITY DEFINER view (CRITICAL). Members can only read their
--      own bookings, so the booked and waitlist counts come from a small function instead.
--   2. end_user_sessions(): signs someone out everywhere. reset-password calls it, so a reset
--      code ends any session on a lost or shared phone.
--   3. Trigger functions can't be called over the API.
--   4. btree_gist moves out of the public schema (advisor: extension in public).

-- 1. Class schedule ---------------------------------------------------------------------

-- Spots taken on a class, for anyone at its gym. Counts only, never who booked.
create function public.class_booking_count(p_class_id uuid, p_status text) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int
  from public.bookings b
  join public.classes c on c.id = b.class_id
  where b.class_id = p_class_id and b.status = p_status and public.is_gym_member(c.gym_id)
$$;

revoke execute on function public.class_booking_count(uuid, text) from public, anon;
grant execute on function public.class_booking_count(uuid, text) to authenticated;

-- Same columns and rows as before; classes and profiles RLS now apply as the caller.
create or replace view public.class_schedule with (security_invoker = on) as
  select
    c.id, c.gym_id, c.trainer_id, coalesce(p.full_name, 'TBA') as trainer_name, c.title,
    c.starts_at, c.duration_minutes, c.capacity,
    public.class_booking_count(c.id, 'booked') as booked_count,
    c.series_id,
    public.class_booking_count(c.id, 'waitlisted') as waitlist_count
  from public.classes c
  left join public.profiles p on p.id = c.trainer_id
  where public.is_gym_member(c.gym_id) and c.status = 'scheduled';

revoke all on public.class_schedule from anon;

-- 2. Ending someone's sessions ----------------------------------------------------------

-- Revokes every refresh token the person holds, so each phone or browser is signed out at its
-- next refresh (within the access token's hour). Service role only (reset-password).
create function public.end_user_sessions(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user_id is null then
    return;
  end if;
  -- Guarded so the migration also runs on plain Postgres (supabase/tests).
  if to_regclass('auth.sessions') is not null then
    execute 'delete from auth.sessions where user_id = $1' using p_user_id;
  end if;
  if to_regclass('auth.refresh_tokens') is not null then
    execute 'delete from auth.refresh_tokens where user_id = $1::text' using p_user_id;
  end if;
end;
$$;

revoke execute on function public.end_user_sessions(uuid) from public, anon, authenticated;

-- 3. Trigger functions --------------------------------------------------------------------

-- Triggers fire whatever the grants, so nobody needs to call these directly.
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;

-- 4. btree_gist ---------------------------------------------------------------------------

-- Constraints point at its operators by id, so moving the schema changes nothing for them.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'extensions')
     and exists (
       select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
       where e.extname = 'btree_gist' and n.nspname = 'public'
     ) then
    alter extension btree_gist set schema extensions;
  end if;
end;
$$;
