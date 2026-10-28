-- CoreFit Gym keeps 1% of each online payment (Venkat, 2026-10-28). The cut is
-- worked out on the plan's price when a payment starts and the owner bears it:
-- with Razorpay's fees passed on, a ₹1,000 plan costs the member ₹1,027.18 and
-- the owner receives ₹990. Payments already started keep the cut they had.
alter table public.platform_settings alter column online_cut_bps set default 100;
update public.platform_settings set online_cut_bps = 100, updated_at = now() where id;
