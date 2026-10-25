-- Signed-in people register their phone for pushes. On the live project the
-- app got "permission denied for function register_push_token" for a member,
-- so grant it (and its counterpart) to signed-in users again. Safe to re-run.
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
