-- Minimal stand-in for Supabase auth so the migrations and rls.sql run on plain Postgres.
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant usage on schema public to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated;
