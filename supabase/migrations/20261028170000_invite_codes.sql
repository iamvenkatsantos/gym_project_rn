-- Invite codes for WhatsApp invites. Staff send an invite on WhatsApp instead
-- of email; it carries a one-time code (and a link with it). The person enters
-- the code in the app, sets their name and password, and the accept-invite
-- edge function creates their account already confirmed: holding the code is
-- the proof the invite reached them, so no email code is needed. Claiming the
-- invite deletes it, so each code works once. Codes expire after 7 days.

alter table public.gym_invites
  add column code text unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  add column code_expires_at timestamptz,
  add column phone text check (phone ~ '^\+?[0-9]{7,15}$');

-- 8 characters from 32 letters and digits (no 0, O, 1 or I), about 10^12
-- codes. The bytes come from gen_random_uuid(), which uses a strong random
-- source; bytes 0-5 and 10-11 of a v4 uuid are fully random.
create function public.new_invite_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code text;
  v_i int;
begin
  loop
    v_bytes := uuid_send(gen_random_uuid());
    v_code := '';
    foreach v_i in array array[0, 1, 2, 3, 4, 5, 10, 11] loop
      v_code := v_code || substr(v_alphabet, 1 + get_byte(v_bytes, v_i) % 32, 1);
    end loop;
    exit when not exists (select 1 from public.gym_invites where code = v_code);
  end loop;
  return v_code;
end;
$$;

revoke execute on function public.new_invite_code() from public, anon, authenticated;

-- Saves an invite like invite_to_gym() (same checks, as the caller) and, when it
-- waits on a sign-up, gives it a code and the mobile number it was sent to.
create function public.whatsapp_invite(p_gym_id uuid, p_email text, p_role text, p_phone text)
returns table (result text, code text)
language plpgsql security definer set search_path = '' as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[\s()-]', '', 'g');
begin
  if v_phone !~ '^\+?[0-9]{7,15}$' then
    raise exception 'Enter a valid mobile number';
  end if;
  result := public.invite_to_gym(p_gym_id, p_email, p_role);
  code := null;
  if result = 'invited' then
    code := public.new_invite_code();
    update public.gym_invites i
      set code = whatsapp_invite.code, code_expires_at = now() + interval '7 days', phone = v_phone
      where i.gym_id = p_gym_id and i.email = lower(trim(p_email));
  end if;
  return next;
end;
$$;

revoke execute on function public.whatsapp_invite(uuid, text, text, text) from public, anon;
grant execute on function public.whatsapp_invite(uuid, text, text, text) to authenticated;

-- "K7P2-QX4M", "k7p2qx4m" and "K7P2 QX4M" are all the same code.
create function public.normalize_invite_code(p_code text) returns text
language sql immutable set search_path = '' as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

-- What the join screen shows for a code, before anyone is signed in. Nothing
-- for a wrong or expired code, or one whose email already has an account.
create function public.invite_by_code(p_code text)
returns table (gym_name text, email text, role text)
language sql stable security definer set search_path = '' as $$
  select g.name, i.email, i.role
  from public.gym_invites i
  join public.gyms g on g.id = i.gym_id
  where i.code = public.normalize_invite_code(p_code)
    and i.code_expires_at > now()
    and not exists (
      select 1 from auth.users u
      where lower(u.email) = i.email and u.email_confirmed_at is not null
    )
$$;

revoke execute on function public.invite_by_code(text) from public;
grant execute on function public.invite_by_code(text) to anon, authenticated;

-- For accept-invite (service role only): the invite behind a code and any
-- account its email already has, such as an imported member's.
create function public.invite_code_account(p_code text)
returns table (email text, phone text, user_id uuid, confirmed boolean)
language sql stable security definer set search_path = '' as $$
  select i.email, i.phone, u.id, u.email_confirmed_at is not null
  from public.gym_invites i
  left join auth.users u on lower(u.email) = i.email
  where i.code = public.normalize_invite_code(p_code)
    and i.code_expires_at > now()
  limit 1
$$;

revoke execute on function public.invite_code_account(text) from public, anon, authenticated;

-- People ------------------------------------------------------------------------------

-- The people list says who has signed up. Imported members are at the gym
-- before they have, and get no trainer until they do.
drop function public.gym_people(uuid);

create function public.gym_people(p_gym_id uuid)
returns table (
  user_id uuid, full_name text, email text, role text, status text, joined_at timestamptz,
  phone text, admitted_by uuid, admitted_by_name text, admitted_at timestamptz,
  onboarded_at timestamptz, avatar_path text, signed_up boolean
)
language sql stable security definer set search_path = '' as $$
  select gm.user_id, p.full_name, u.email::text, gm.role, gm.status, gm.joined_at,
         cd.phone, gm.admitted_by, admitter.full_name, gm.admitted_at, gm.onboarded_at,
         p.avatar_path, u.email_confirmed_at is not null
  from public.gym_members gm
  join public.profiles p on p.id = gm.user_id
  join auth.users u on u.id = gm.user_id
  left join public.contact_details cd on cd.user_id = gm.user_id
  left join public.profiles admitter on admitter.id = gm.admitted_by
  where gm.gym_id = p_gym_id and public.can_manage_gym(p_gym_id)
  order by p.full_name
$$;

revoke execute on function public.gym_people(uuid) from public, anon;
grant execute on function public.gym_people(uuid) to authenticated;

-- Trainers are matched with members who have signed up, never before.
create function public.member_trainers_signed_up() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from auth.users u where u.id = new.member_id and u.email_confirmed_at is not null
  ) then
    raise exception 'They haven''t signed up yet. Add a trainer once they join.';
  end if;
  return new;
end;
$$;

create trigger member_trainers_signed_up
  before insert on public.member_trainers
  for each row execute function public.member_trainers_signed_up();
