-- The admin sets up a new owner's gym when inviting them (Venkat, 2026-10-29): the owner
-- never creates a gym, they only edit its details. One call makes the brand and its first
-- branch and invites the owner to it, so a failed invite leaves no empty gym behind. An
-- owner with an account joins at once; anyone else joins when they confirm, like every
-- other invite (claim_gym_invites), or with the WhatsApp code when a mobile is given.
create function public.admin_create_owner_gym(
  p_name text, p_city text, p_email text, p_phone text default null
) returns table (gym_id uuid, result text, code text)
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_brand_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Only CoreFit Gym admins can set up a gym';
  end if;
  if length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'Enter the gym''s name';
  end if;
  if v_email not like '%_@_%' then
    raise exception 'Enter a valid email address';
  end if;
  if v_email = (select lower(email) from auth.users where id = auth.uid()) then
    raise exception 'Invite the gym owner''s email, not yours';
  end if;

  insert into public.brands (name) values (v_name) returning id into v_brand_id;
  insert into public.gyms (name, city, created_by, brand_id)
  values (v_name, trim(coalesce(p_city, '')), auth.uid(), v_brand_id)
  returning id into gym_id;

  if p_phone is null then
    result := public.invite_to_gym(gym_id, v_email, 'owner');
    code := null;
  else
    select w.result, w.code into result, code from public.whatsapp_invite(gym_id, v_email, 'owner', p_phone) w;
  end if;

  -- Their gym is ready, so an older "set up your gym" invite has nothing left to do.
  delete from public.gym_setup_invites where email = v_email;
  return next;
end;
$$;

revoke execute on function public.admin_create_owner_gym(text, text, text, text) from public, anon;
grant execute on function public.admin_create_owner_gym(text, text, text, text) to authenticated;
