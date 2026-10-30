-- Online payments are part of the yearly plan now (Venkat, 2026-10-30): no
-- add-on. Razorpay moves the money and the owner pays its fees, so CoreFit Gym
-- adds nothing to the bill. The column and bill math stay in case it returns.
alter table public.platform_settings alter column online_addon_cents set default 0;
update public.platform_settings set online_addon_cents = 0, updated_at = now() where id;
