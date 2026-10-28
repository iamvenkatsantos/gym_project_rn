-- CoreFit Gym keeps 1% of each online payment (Venkat, 2026-10-28). The cut is
-- worked out on the plan's price when a payment starts. Where the branch passes
-- the fees on (the default), the member pays it as a "CoreFit Gym fee" with
-- Razorpay's fees: a ₹1,000 plan costs ₹1,037.44 and the owner receives ₹1,000.
-- Where the owner bears the fees, the cut comes out of what the owner receives.
-- Payments already started keep the cut they had.
alter table public.platform_settings alter column online_cut_bps set default 100;
update public.platform_settings set online_cut_bps = 100, updated_at = now() where id;
