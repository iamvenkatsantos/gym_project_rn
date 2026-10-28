-- A role can't be changed once it's given (Venkat, 2026-10-28). Owners used to switch roles
-- from the person screen; that picker is gone, and this trigger refuses every role change
-- by a signed-in user except a CoreFit Gym admin, who may fix a wrong role. The SQL editor
-- (no signed-in user) can still fix one too. It replaces the "only admins make owners" check.
drop trigger if exists gym_members_only_admins_make_owners on public.gym_members;
drop function if exists public.only_admins_make_owners();

create function public.lock_gym_member_role() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'A role can''t be changed once it''s given';
  end if;
  return new;
end;
$$;

create trigger gym_members_lock_role
  before update of role on public.gym_members
  for each row execute function public.lock_gym_member_role();
