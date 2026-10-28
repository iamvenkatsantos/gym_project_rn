-- Importing members from a spreadsheet. An owner moving from another gym app
-- fills in the CoreFit Gym template (name, email, mobile, plan, dates, amount)
-- and imports it from the People tab. The import-members edge function first
-- makes an account for every email that has none (unconfirmed, no email sent),
-- then calls import_members() as the owner. So imported members are at the gym
-- straight away, with their membership, renewals and reminders, before they
-- ever open the app; their invite email can go out later. When they confirm
-- the invite, claim_gym_invites() finds them already here.

create function public.import_members(p_gym_id uuid, p_rows jsonb)
returns table (email text, result text, joined boolean, message text)
language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb;
  v_email text;
  v_name text;
  v_phone text;
  v_plan public.membership_plans;
  v_starts date;
  v_ends date;
  v_amount int;
  v_method text;
  v_user auth.users;
  v_member public.gym_members;
  v_tz text;
begin
  if not public.has_gym_role(p_gym_id, array['owner']) and not public.is_platform_admin() then
    raise exception 'Only owners can import members';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Rows must be a list';
  end if;
  if jsonb_array_length(p_rows) > 200 then
    raise exception 'Import at most 200 rows at a time';
  end if;
  select g.time_zone into v_tz from public.gyms g where g.id = p_gym_id;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    email := lower(trim(coalesce(v_row ->> 'email', '')));
    v_email := email;
    joined := false;
    message := null;
    v_plan := null;
    v_starts := null;
    v_ends := null;

    -- Check the whole row before changing anything, so a bad row changes nothing.
    begin
      if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        raise exception 'Enter a valid email';
      end if;
      v_name := trim(coalesce(v_row ->> 'name', ''));
      if length(v_name) > 60 then
        raise exception 'Keep the name under 60 characters';
      end if;
      v_phone := regexp_replace(coalesce(v_row ->> 'phone', ''), '[\s()-]', '', 'g');
      if v_phone <> '' and v_phone !~ '^\+?[0-9]{7,15}$' then
        raise exception 'Enter a valid mobile number';
      end if;

      if coalesce(trim(v_row ->> 'plan'), '') <> '' then
        select * into v_plan from public.membership_plans mp
          where mp.gym_id = p_gym_id and mp.active
            and lower(trim(mp.name)) = lower(trim(v_row ->> 'plan'))
          limit 1;
        if v_plan.id is null then
          raise exception 'No plan called "%" at this gym', trim(v_row ->> 'plan');
        end if;
        v_starts := (v_row ->> 'starts_on')::date;
        if v_starts is null then
          raise exception 'Add a start date';
        end if;
        v_ends := coalesce((v_row ->> 'ends_on')::date, v_starts + v_plan.duration_days - 1);
        if v_ends < v_starts then
          raise exception 'The end date is before the start date';
        end if;
        v_amount := (v_row ->> 'amount_paid_cents')::int;
        if v_amount < 0 then
          raise exception 'The amount can''t be negative';
        end if;
        v_method := coalesce(nullif(v_row ->> 'payment_method', ''),
                             case when v_amount is not null then 'cash' end);
        if v_method is not null
           and v_method not in ('cash', 'upi', 'card', 'bank_transfer', 'complimentary') then
          raise exception 'Unknown payment method';
        end if;
      end if;

      select * into v_user from auth.users u where lower(u.email) = v_email limit 1;
      if v_user.id is null then
        raise exception 'No account for this email yet';
      end if;
      joined := v_user.email_confirmed_at is not null;

      select * into v_member from public.gym_members gm
        where gm.gym_id = p_gym_id and gm.user_id = v_user.id;
      if v_member.user_id is not null and v_member.role <> 'member' then
        raise exception 'Already at your gym as a %', v_member.role;
      end if;
      if v_member.user_id is not null and v_member.status <> 'active' then
        raise exception 'Suspended at your gym';
      end if;
    exception when others then
      result := 'skipped';
      message := sqlerrm;
      return next;
      continue;
    end;

    if v_member.user_id is null then
      insert into public.gym_members (gym_id, user_id, role, admitted_by, admitted_at)
      values (p_gym_id, v_user.id, 'member', auth.uid(), now());
      result := 'added';
    else
      result := 'updated';
    end if;

    -- Never overwrite what the member typed themselves.
    if v_name <> '' then
      update public.profiles set full_name = v_name where id = v_user.id and full_name = '';
    end if;
    if v_phone <> '' then
      insert into public.contact_details (user_id, phone) values (v_user.id, v_phone)
        on conflict (user_id) do nothing;
    end if;

    if v_plan.id is not null then
      if exists (
        select 1 from public.memberships m
        where m.member_id = v_user.id and m.plan_id = v_plan.id and m.starts_on = v_starts
      ) then
        message := 'Membership was already imported';
      else
        -- Dated to its start, so old payments don't show as this month's collections.
        insert into public.memberships
          (member_id, plan_id, starts_on, ends_on, amount_paid_cents, payment_method, note,
           recorded_by, created_at)
        values
          (v_user.id, v_plan.id, v_starts, v_ends, v_amount, v_method, 'Imported',
           auth.uid(), least(now(), v_starts::timestamp at time zone v_tz));
      end if;
    end if;
    return next;
  end loop;
end;
$$;

revoke execute on function public.import_members(uuid, jsonb) from public, anon;
grant execute on function public.import_members(uuid, jsonb) to authenticated;
