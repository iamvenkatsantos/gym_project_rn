-- 20261028020000 gave gym_members a second foreign key to profiles (admitted_by),
-- so PostgREST can no longer tell which one an embed like
-- profiles -> gym_members(...) means (PGRST201), and sign-in failed in apps
-- already installed. admitted_by stays as a plain id: the admission keeps the
-- inviter's id even if their account is deleted later, and names are looked up
-- with a left join, so a missing profile just shows no name.
alter table public.gym_members drop constraint if exists gym_members_admitted_by_fkey;

comment on column public.gym_members.admitted_by is
  'Who invited (admitted) this member: a profiles.id, deliberately without a foreign key so profile/gym_members embeds stay unambiguous.';
