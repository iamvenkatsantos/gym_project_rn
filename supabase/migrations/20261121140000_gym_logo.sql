-- Gym logo per branch (2026-11-21, Venkat): the platform admin sets it (owners don't); the launch screen, the Home header
-- and (later) other places show it to everyone at the branch, with "Powered by CoreFit".
-- Files sit in the public gym-logos bucket at <gym id>/<random>.<ext> (random name, can't be listed).

alter table public.gyms
  add column logo_path text
  constraint gyms_logo_in_own_folder check (logo_path is null or logo_path like id::text || '/%');

-- Everyone at the branch reads it with the gym row; writes go only through the function below
-- (this column isn't in gyms' column-level update grants).
grant select (logo_path) on public.gyms to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gym-logos', 'gym-logos', true, 2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Only platform admins touch the files (the folder is the branch's id).
create policy "Admins upload gym logos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'gym-logos' and public.is_platform_admin()
  );
create policy "Admins see gym logos" on storage.objects
  for select to authenticated using (
    bucket_id = 'gym-logos' and public.is_platform_admin()
  );
create policy "Admins delete gym logos" on storage.objects
  for delete to authenticated using (
    bucket_id = 'gym-logos' and public.is_platform_admin()
  );

create function public.set_gym_logo(p_gym_id uuid, p_path text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only the platform admin changes the gym logo';
  end if;
  if p_path is not null and p_path not like p_gym_id::text || '/%' then
    raise exception 'The logo must be in the gym''s own folder';
  end if;
  update public.gyms set logo_path = p_path where id = p_gym_id;
end;
$$;

revoke execute on function public.set_gym_logo(uuid, text) from public, anon;
grant execute on function public.set_gym_logo(uuid, text) to authenticated;

-- The admin's branch screen reads the current logo (admins aren't members of the branch).
create function public.admin_gym_logo(p_gym_id uuid)
returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only the platform admin reads this';
  end if;
  return (select logo_path from public.gyms where id = p_gym_id);
end;
$$;

revoke execute on function public.admin_gym_logo(uuid) from public, anon;
grant execute on function public.admin_gym_logo(uuid) to authenticated;
