-- Theme colour per branch (2026-11-21, Venkat): the owner picks it and every member, trainer and
-- supervisor of the branch sees it in the app, and the owner's web dashboard too. Nobody else picks
-- one; light/dark stays each person's own choice. Ids match ThemeColors in src/constants/theme.ts.

alter table public.gyms
  add column theme_color text not null default 'green'
  constraint gyms_theme_color_check check (theme_color in ('green', 'blue', 'purple', 'orange', 'pink'));

-- Everyone at the branch reads it with the gym row; writes go only through the function below
-- (gyms has column-level update grants, and this column isn't one of them).
grant select (theme_color) on public.gyms to authenticated;

create function public.set_gym_theme_color(p_gym_id uuid, p_color text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_gym_role(p_gym_id, array['owner']) then
    raise exception 'Only owners change the theme colour';
  end if;
  if p_color is null or p_color not in ('green', 'blue', 'purple', 'orange', 'pink') then
    raise exception 'Unknown theme colour';
  end if;
  update public.gyms set theme_color = p_color where id = p_gym_id;
end;
$$;

revoke execute on function public.set_gym_theme_color(uuid, text) from public, anon;
grant execute on function public.set_gym_theme_color(uuid, text) to authenticated;
