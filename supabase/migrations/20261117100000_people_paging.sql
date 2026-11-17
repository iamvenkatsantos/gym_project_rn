-- People screen paging (perf audit, 2026-11-17). gym_people() sends everyone at once; at 300
-- members that is ~137 KB before the screen can draw. These two return one page at a time, with
-- the filter and search done here, plus the chip counts. gym_people() stays for older apps and
-- for the pickers that need the whole list. Same rows, same access check, same order.

-- A page of people. p_filter is all, member, trainer, supervisor, owner or suspended, as the
-- app's chips. p_query matches name or email, case-insensitive, with % and _ taken literally.
-- total is the number of matches before paging.
create function public.gym_people_page(
  p_gym_id uuid, p_filter text default 'all', p_query text default '',
  p_limit int default 50, p_offset int default 0
)
returns table (
  user_id uuid, full_name text, email text, role text, status text, joined_at timestamptz,
  phone text, admitted_by uuid, admitted_by_name text, admitted_at timestamptz,
  onboarded_at timestamptz, avatar_path text, signed_up boolean, date_of_birth date,
  total bigint
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_like text := '%' || replace(replace(replace(lower(trim(coalesce(p_query, ''))), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  if p_filter not in ('all', 'member', 'trainer', 'supervisor', 'owner', 'suspended') then
    raise exception 'Unknown filter';
  end if;
  if p_limit not between 1 and 200 or p_offset < 0 then
    raise exception 'Bad page';
  end if;
  return query
    select gm.user_id, p.full_name, u.email::text, gm.role, gm.status, gm.joined_at,
           cd.phone, gm.admitted_by, admitter.full_name, gm.admitted_at, gm.onboarded_at,
           p.avatar_path, u.email_confirmed_at is not null, cd.date_of_birth,
           count(*) over ()
    from public.gym_members gm
    join public.profiles p on p.id = gm.user_id
    join auth.users u on u.id = gm.user_id
    left join public.contact_details cd on cd.user_id = gm.user_id
    left join public.profiles admitter on admitter.id = gm.admitted_by
    where gm.gym_id = p_gym_id and gm.status <> 'moved' and public.can_manage_gym(p_gym_id)
      and (p_filter = 'all'
           or (p_filter = 'suspended' and gm.status = 'suspended')
           or (p_filter <> 'suspended' and gm.role = p_filter and gm.status <> 'suspended'))
      and (v_like = '%%'
           or lower(p.full_name) like v_like escape '\'
           or lower(u.email::text) like v_like escape '\')
    order by p.full_name, gm.user_id
    limit p_limit offset p_offset;
end;
$$;

-- The chip counts: everyone, each role (not suspended) and suspended, like the app's countPeople.
create function public.gym_people_counts(p_gym_id uuid)
returns table (everyone bigint, members bigint, trainers bigint, supervisors bigint, owners bigint, suspended bigint)
language sql stable security definer set search_path = '' as $$
  select count(*),
         count(*) filter (where gm.status <> 'suspended' and gm.role = 'member'),
         count(*) filter (where gm.status <> 'suspended' and gm.role = 'trainer'),
         count(*) filter (where gm.status <> 'suspended' and gm.role = 'supervisor'),
         count(*) filter (where gm.status <> 'suspended' and gm.role = 'owner'),
         count(*) filter (where gm.status = 'suspended')
  from public.gym_members gm
  where gm.gym_id = p_gym_id and gm.status <> 'moved' and public.can_manage_gym(p_gym_id)
$$;

revoke execute on function public.gym_people_page(uuid, text, text, int, int) from public, anon;
grant execute on function public.gym_people_page(uuid, text, text, int, int) to authenticated;
revoke execute on function public.gym_people_counts(uuid) from public, anon;
grant execute on function public.gym_people_counts(uuid) to authenticated;
