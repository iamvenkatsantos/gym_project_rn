-- Online payments, simpler for members (Venkat, 2026-10-28): members see one
-- price with no fee or GST lines. Owners bear Razorpay's fees and CoreFit Gym's
-- cut, and raise their plan prices to cover them if they want to. Every branch,
-- existing ones included, now has the owner paying; the admin can still switch a
-- branch to members paying the fees.
--
-- CoreFit Gym's cut drops from 1% to 0.25%. On a ₹1,000 plan the owner now
-- receives ₹971.03: ₹1,000 less Razorpay's gateway fee (₹23.60), our cut (₹2.50)
-- and Razorpay's transfer fee (₹2.87). Payments already started keep the cut
-- they had.
alter table public.gyms alter column online_fees_on_member set default false;
update public.gyms set online_fees_on_member = false where online_fees_on_member;

alter table public.platform_settings alter column online_cut_bps set default 25;
update public.platform_settings set online_cut_bps = 25, updated_at = now() where id;
