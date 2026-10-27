-- The branch QR is handed to each gym by CoreFit Gym's admin, not shown on the
-- web dashboard. The admin reads (and can reset) any branch's printed QR; the
-- signed-out display link the web dashboard used is gone.

revoke execute on function public.check_in_display(text) from anon;

-- Admins: a branch's printed QR code, made on first read.
create function public.admin_check_in_qr(p_gym_id uuid)
returns table (gym_name text, poster_code text, poster_enabled boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_codes public.gym_check_in_codes;
begin
  if not public.is_platform_admin() then
    raise exception 'Only CoreFit Gym admins see every branch''s QR';
  end if;
  if not exists (select 1 from public.gyms g where g.id = p_gym_id) then
    raise exception 'Branch not found';
  end if;
  v_codes := public.ensure_check_in_codes(p_gym_id);
  return query
    select g.name, v_codes.poster_code, v_codes.poster_enabled
    from public.gyms g where g.id = p_gym_id;
end;
$$;

revoke execute on function public.admin_check_in_qr(uuid) from public, anon;
grant execute on function public.admin_check_in_qr(uuid) to authenticated;

-- Admins: a new printed QR for a branch, and switch it back on. Old printouts stop working.
create function public.admin_reset_check_in_qr(p_gym_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only CoreFit Gym admins see every branch''s QR';
  end if;
  perform public.ensure_check_in_codes(p_gym_id);
  update public.gym_check_in_codes
  set poster_code = public.random_check_in_secret(20), poster_enabled = true, updated_at = now()
  where gym_id = p_gym_id;
end;
$$;

revoke execute on function public.admin_reset_check_in_qr(uuid) from public, anon;
grant execute on function public.admin_reset_check_in_qr(uuid) to authenticated;
