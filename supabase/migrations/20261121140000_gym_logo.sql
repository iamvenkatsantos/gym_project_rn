-- Gym logo per branch (2026-11-21, Venkat): the owner uploads it; the launch screen, the Home header
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

-- Only the branch's owners touch the files in its <gym id>/ folder.
create policy "Owners upload their gym logo" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'gym-logos'
    and public.has_gym_role(public.storage_path_uuid(name, 1), array['owner'])
  );
create policy "Owners see their gym logos" on storage.objects
  for select to authenticated using (
    bucket_id = 'gym-logos'
    and public.has_gym_role(public.storage_path_uuid(name, 1), array['owner'])
  );
create policy "Owners delete their gym logo" on storage.objects
  for delete to authenticated using (
    bucket_id = 'gym-logos'
    and public.has_gym_role(public.storage_path_uuid(name, 1), array['owner'])
  );

create function public.set_gym_logo(p_gym_id uuid, p_path text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_gym_role(p_gym_id, array['owner']) then
    raise exception 'Only owners change the gym logo';
  end if;
  if p_path is not null and p_path not like p_gym_id::text || '/%' then
    raise exception 'The logo must be in the gym''s own folder';
  end if;
  update public.gyms set logo_path = p_path where id = p_gym_id;
end;
$$;

revoke execute on function public.set_gym_logo(uuid, text) from public, anon;
grant execute on function public.set_gym_logo(uuid, text) to authenticated;
