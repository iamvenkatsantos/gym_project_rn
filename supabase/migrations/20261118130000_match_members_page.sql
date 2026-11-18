-- Match trainers paging (perf audit, 2026-11-18). "No trainer yet" on Home opens Match trainers,
-- which downloaded everyone (gym_people ~137 KB) and every trainer link (~38 KB) at 300 members
-- and drew every member. This returns one page of the members to match, with their trainers'
-- names and the chip counts. Same rules as the app's membersToMatch() and trainerSummary():
--   who      active members who have signed up (a confirmed account)
--   search   name (or email when there's no name) or email contains the text, case-insensitive
--   order    no trainer first, then name
--   p_unmatched true: only members with no trainer at this gym
-- total counts the page's filter; unmatched_count and members_count are the two chips (with the
-- search applied, like the app). An empty page is one row with a null user_id, so the counts still
-- arrive. Owners and supervisors only.
create function public.gym_match_members_page(
  p_gym_id uuid, p_unmatched boolean default true, p_query text default '',
  p_limit int default 50, p_offset int default 0
)
returns table (
  user_id uuid, full_name text, email text, avatar_path text, trainer_names text[],
  total bigint, unmatched_count bigint, members_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_like text := '%' || replace(replace(replace(lower(trim(coalesce(p_query, ''))), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  if not public.can_manage_gym(p_gym_id) then
    raise exception 'Only owners and supervisors match trainers';
  end if;
  if p_limit not between 1 and 200 or p_offset < 0 then
    raise exception 'Bad page';
  end if;
  return query
    with members as (
      select gm.user_id,
             coalesce(nullif(p.full_name, ''), u.email::text, 'Unnamed') as full_name,
             u.email::text as email,
             p.avatar_path,
             coalesce((
               select array_agg(coalesce(nullif(tp.full_name, ''), 'Trainer') order by tp.full_name)
               from public.member_trainers mt
               join public.profiles tp on tp.id = mt.trainer_id
               where mt.gym_id = p_gym_id and mt.member_id = gm.user_id
             ), '{}') as trainer_names
      from public.gym_members gm
      join public.profiles p on p.id = gm.user_id
      join auth.users u on u.id = gm.user_id
      where gm.gym_id = p_gym_id and gm.role = 'member' and gm.status = 'active'
        and u.email_confirmed_at is not null
    ),
    found as (
      select m.* from members m
      where v_like = '%%'
         or lower(m.full_name) like v_like escape '\'
         or lower(coalesce(m.email, '')) like v_like escape '\'
    ),
    counts as (
      select count(*) filter (where cardinality(f.trainer_names) = 0) as unmatched,
             count(*) as everyone
      from found f
    )
    -- From the counts, so an empty page still brings the chip counts (one row, user_id null).
    select f.user_id, f.full_name, f.email, f.avatar_path, f.trainer_names,
           case when p_unmatched then c.unmatched else c.everyone end, c.unmatched, c.everyone
    from counts c
    left join lateral (
      select fd.* from found fd
      where not p_unmatched or cardinality(fd.trainer_names) = 0
      order by cardinality(fd.trainer_names) > 0, fd.full_name, fd.user_id
      limit p_limit offset p_offset
    ) f on true
    order by cardinality(f.trainer_names) > 0, f.full_name, f.user_id;
end;
$$;

revoke execute on function public.gym_match_members_page(uuid, boolean, text, int, int) from public, anon;
grant execute on function public.gym_match_members_page(uuid, boolean, text, int, int) to authenticated;
