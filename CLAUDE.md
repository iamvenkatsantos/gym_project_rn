# CLAUDE.md

Guide for Claude sessions working on CoreFit Gym. Read this first, then `AGENTS.md` (Expo rules and
code layout, imported below) and `README.md` (setup, push and Razorpay details).

@AGENTS.md

## What this is

CoreFit Gym (product of VinVen Technologies) is one Expo app for gym members, trainers, supervisors
and owners, plus a platform admin who runs CoreFit Gym itself. Bundle id `com.corefit.gym`, URL
scheme `corefit://`. Android ships first; iOS push (APNs) is not set up yet.

- **App:** Expo SDK 58, Expo Router (`src/app/`), TypeScript strict, TanStack Query for server
  state, Zustand for the auth session and offline drafts.
- **Backend:** Supabase. Postgres with RLS on every table, most writes through `security definer`
  RPCs, edge functions in `supabase/functions/`, `pg_cron` + `pg_net` for jobs and push.
- **Owner web dashboard:** a separate Vite app in `web/` that reuses pure files from `src/` (see
  `web/README.md`). Live at `https://dashboard.vinven.net` (Cloudflare Workers Builds, deploys on
  push to `main`). Never import React Native code into it. No QR on the web.

## Folder map

| Path                         | What lives there                                                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/_layout.tsx`        | Root navigator: every gate and role is a `Stack.Protected` guard                                                                                           |
| `src/app/<role>/`            | Tab areas: `member`, `trainer`, `supervisor`, `owner`, `admin`                                                                                             |
| `src/app/*.tsx`, `[id]` dirs | Shared stack screens (person, plan-editor, record-membership, check-in, …)                                                                                 |
| `src/features/<feature>/`    | `types.ts`, `api.ts`, `hooks.ts`, `rules.ts`, `components/`, `__tests__/`                                                                                  |
| `src/components/`            | Shared UI: `Screen`, Button, Card, ListRow, StatTile, ShortcutGrid, TextField, …                                                                           |
| `src/constants/theme.ts`     | Light/dark tokens, `TapTarget`, `MaxFontScale`                                                                                                             |
| `src/lib/`                   | `supabase.ts`, `env.ts` (`isDemoMode`), `mock-db.ts`, `query-client.ts`                                                                                    |
| `supabase/migrations/`       | One timestamped file per change; never edit a pushed migration                                                                                             |
| `supabase/functions/`        | `invite-member`, `accept-invite`, `join`, `import-members`, `send-push`, `create-payment`, `razorpay-webhook`, `delete-account`; shared code in `_shared/` |
| `supabase/tests/`            | SQL checks run on plain Postgres (see README "Database checks")                                                                                            |
| `supabase/templates/`        | Auth email templates, pasted into Supabase by hand                                                                                                         |
| `infra/api-proxy/`           | Cloudflare Worker behind `api.vinven.net`, the app's Supabase URL; pasted into Cloudflare by hand                                                          |

## Roles and who sees what

- Roles are **per gym** (`gym_members.role`: member, trainer, supervisor, owner). One person can
  hold different roles at different gyms. The auth store's active gym (`selectActiveGym`) decides
  which area the root layout opens, and every API call takes a `gymId`.
- **Staff roles nest:** owner ⊇ supervisor ⊇ trainer; member is never implied. In SQL use
  `has_gym_role(gym, array['trainer'])` or `is_coach()`, never `role = 'trainer'`. In the app use
  `canCoach(role)` and `canManageGym(role)` from `src/features/auth/types.ts`. Owners and supervisors
  coach under Training → Coaching.
- **Owner only:** CSV exports, importing members, Insights, suspending or removing people, membership
  plans, gym details, trainer hours/LOP rules and approving trainer permissions.
- **Roles never change once given** (`gym_members_lock_role` trigger). There is no role picker in
  the app; only a platform admin (or the SQL editor) can fix a wrong role. Re-inviting someone
  already at the gym keeps their role. **One exception:** owners and supervisors can make an active
  member a trainer (person screen → **Make trainer**, `promote_to_trainer()`, the only path the
  trigger lets through). It removes their trainer links, workout and diet plan assignments and
  pending trainer requests; history and memberships stay. It can't be undone in the app.
- **Platform admin** (`platform_admins` + `is_platform_admin()`, rows added in the SQL editor only)
  is separate from gym roles. Only the admin invites owners, adds branches, sets branch fees and
  switches on online payments. Never give gym owners power over gyms or owners. The admin area
  (`src/app/admin`) shows owners, branches and billing; admins switch to a gym from Account
  (`selectInAdmin`). **The admin sets up every new gym:** Admin → Owners → **Invite a gym owner**
  (`invite-owner`) takes the gym's name and city plus the owner's email (and mobile for WhatsApp),
  and `admin_create_owner_gym()` makes the brand, its first branch and the owner invite in one
  transaction (WhatsApp gets a join code; email goes through `invite-member` with role
  `gym_owner` and the `gymId`). Owners never create a gym; they edit its details on Gym details.
  Works with zero gyms. The admin never joins the gym or invites their own email. The older
  `invite_gym_owner()` → `set-up-gym` path stays only for invites sent before this; in-gym
  Invite → Owner adds a co-owner.
- **Brands and branches:** every gym is a branch of a brand (`gyms.brand_id`). Owners with 2+
  branches get a branch switcher and an All branches view. Billing is per branch and **yearly**
  (`gyms.fee_cents`, null means the `platform_settings` default of ₹4,999; 0 makes the branch free:
  **Make this branch free** on the admin branch screen or when adding one). Members use their home branch only.
- **Workout and diet plans are private:** members see plans from their own trainers
  (`member_trainers`) plus plans assigned to them; trainers see their own; owners and supervisors
  see all, read-only for other coaches' plans. New plan-like features follow the same rule.

## Core flows

**Invite and admission.** People join by invite (People / Members tab → `invite-person`), sent on
WhatsApp or by email. **Invite on WhatsApp** saves the invite with a one-time 8-character code
(`whatsapp_invite()` RPC, 7 days, no email; new gym owners get no code) and opens WhatsApp with
`inviteMessage()`, which carries the code and a join link. The link goes through the `join` edge fn
(WhatsApp only makes https tappable), which redirects to `corefit://join?code=…` or the Play Store.
On `join` (or Sign in → I have an invite code) the person enters name and password; the
`accept-invite` edge fn makes the account already confirmed (or takes over an imported one), which
claims the invite, so each code works once. Signing up with the invited email still works too.
**Invite by email**: the `invite-member` edge fn calls
`invite_to_gym()` (or, for an older new-gym invite, `invite_gym_owner()`) as the caller, then sends the
email with the service role. Supervisors invite members and trainers; trainers invite members only,
and those members are auto-mapped to them. Every member invite records an admission
(`gym_members.admitted_by` / `admitted_at`, frozen by trigger). Emails carry a 6-digit code
(`enter-code`, `verifyOtp`) because links can't open the app from a computer. `claim_gym_invites`
attaches pending invites when the user confirms. Pending invites list as **Invited** on People, and
members who haven't confirmed an account (imported) show an Invited tag (`gym_people.signed_up`).
**No trainer or plan before they join:** `member_trainers_signed_up` trigger, `isSignedUp()` in the
pickers. Login is email only (no phone OTP); Google or other
OAuth may come later.

**Member import.** Owners bring members over from another app on People → `import-members`: share
the CSV template, pick the filled CSV (`expo-document-picker`; .xlsx must be saved as CSV), check
the preview (`import-rules.ts`: name, email and Indian mobile required; plan must match an active
plan; day-first dates; end date defaults from the plan), import, then share a join message. The
`import-members` edge fn makes an unconfirmed account (no email, `app_metadata.imported`) for each
new email with the service role, then calls `import_members()` as the owner, which adds them as
active members (admitted by the owner), fills an empty name, sets the mobile only if they have none,
and records the membership dated to its start day (not today, so collections reports aren't skewed);
re-importing never duplicates. So imported members get renewals and reminders before they ever sign
in. **No bulk invite emails by default:** the owner shares `joinMessage()` on WhatsApp, members tap
Create account with the same email, and confirming the sign-up code joins the imported account;
`enter-code` and `use-auth-links` send imported accounts to `set-password`, since Supabase may keep
them passwordless. Emailing invites one by one (`invite-member`) is an optional extra; mind the SMTP
provider's hourly limit.

**Sign-in gates** (in order, all in `src/app/_layout.tsx`): signed out → `sign-in`/`enter-code`;
invited without password → `set-password`; member with `needsOnboarding` → `onboarding` (name,
phone, weight, height, front/back/side photos via `complete_member_onboarding`, optional profile
photo); anyone else without a mobile number (`Profile.phone === null`, mostly staff, via
`selectNeedsProfile`) → `profile-setup` (name, required mobile, optional photo via `save_my_profile`);
no gym →
`no-gym` (older new-owner invites → `set-up-gym`, `create_gym`); admin → `admin`; otherwise the
role's area. Roles and profile refetch when the app comes to the foreground.

**Profiles.** Every role must have a mobile number (in `contact_details`, readable only by the
person, their gym's managers and, for members, their mapped trainers) and may add a profile photo.
Photos live in the public `avatars` bucket at `<user id>/<random>.<ext>` (`profiles.avatar_path`,
checked to sit in the person's own folder); progress photos stay private. Anyone edits their photo,
name and mobile on `edit-profile` (tap the profile card, or Edit profile on Profile/Account). Use
`TrainerAvatar` with `url` to show a photo with initials as the fallback.

**Attendance and QR.** Members and staff check in/out from Home. Members must be checked in to start
a workout (`start_workout_attendance` raises "Check in first"). **No membership, no training:** a
member needs a membership covering today (`has_current_membership()`, the gym's day) to check in
(button or QR), start a workout, book a class or book a trainer; `require_membership()` raises "No
active membership…" in `check_in`, `scan_check_in` (checking out still works),
`start_workout_attendance`, `book_class` and `book_trainer_session`. Staff never need one. The app
mirrors it with `useHasMembership` and `NoMembershipNotice`. New members are blocked until their
first membership is recorded. Each branch has a QR
(`corefit://check-in?gym=…&code=…`): a rotating live code on the owner's `check-in-display` and a
fixed poster code the admin shares as an image. `scan_check_in` toggles in/out;
`gyms.qr_check_in_only` blocks the button check-in; `auto_check_out()` closes stale visits.
**Opening hours:** owners set each branch's `gyms.opens_at`/`closes_at` (`set_gym_hours()`, both null =
open 24 hours, closing before opening = after midnight) on Attendance → **Check-in QR and settings**,
next to the auto check-out hours; supervisors see them read-only and Home shows them. Check-in is
never blocked outside hours (Venkat, 2026-10-30), but `auto_check_out()` checks everyone still in out
at closing time or after their role's hours, whichever comes first.
Mapped trainers get pushes when their member starts and finishes a workout.

**Trainer hours, LOP and permissions** (owner only, secret from trainers and supervisors). Owners set
per-branch rules on Dashboard → **Trainer hours** → Rules (`trainer_hour_rules`, `set_trainer_hour_rules()`):
working hours a day, allowed shortfall, LOP hours and weekly off days. A working day short by more
than the allowed shortfall costs the rule's LOP hours; a day with no check-in and no permission costs
the full day; off days and today never count, nor days before the rules were first saved
(`starts_on`) or before the trainer joined. Hours worked add up every visit that day
(`attendance.worked_minutes`, kept by the `attendance_worked_minutes` trigger on each check-out;
`longest_visit_minutes` is kept too). Only `gym_members.role = 'trainer'` is tracked. Trainers ask
for permission from Home → **Ask for permission** (`permissions`, `request_permission()`: a day, from/to
time, a reason, optional note; owners get a push) and see only their requests and the answer, never
hours or LOP. Owners approve or reject (`decide_permission()`, trainer gets a push); approved
permission counts as time worked. `trainer_hours_month()` returns the days; the LOP maths is
`applyRules`/`summariseMonth` in `src/features/trainer-hours/rules.ts`. LOP is in hours; the app
knows no salaries.

**Workouts and plans.** Coaches build plans (`plan-editor`, `save_workout`) and assign them to
mapped members (`assign-plan`). Mapping is many trainers per member (`member_trainers`), managed
by owners and supervisors from `match-trainers` (members without a trainer first), then
`member-trainers/[memberId]` or bulk `trainer-members/[trainerId]`. Both pickers save only on
**Save** (`SaveBar`, `changeTrainerLinks`); unmapping deletes that trainer's plan assignments (DB
trigger), so the bar warns first. Members can ask for a trainer (`trainer_requests`). Members log sessions in
`workout-session` with an offline draft (`src/features/progress/draft-store.ts`, Zustand persist)
uploaded idempotently by `workout_logs.client_id`. Diet plans and body progress (measurements,
private progress photos) follow the same coach/member pattern.

**Memberships and payments.** Owners set plans (`membership-plan-editor`); owners and supervisors
record cash/UPI payments and renewals (`record-membership`) and chase renewals (`renewals`,
`remind_renewal` push, or a WhatsApp button with a written message from `renewalMessage`). Online
payments are switched on per branch by the admin and cost the owner nothing extra
(`platform_settings.online_addon_cents` 0, Venkat 2026-10-30; the add-on math stays): `create-payment` makes a Razorpay Payment Link
opened in the in-app browser (no native SDK), `razorpay-webhook` verifies the signature and calls
`complete_online_payment()`, and the browser returns to `corefit://payment-return`. The gym's share
goes to the owner's Razorpay **Route** linked account (`gyms.razorpay_account_id`); member money
never stays with CoreFit Gym. By default the owner pays all fees and the members see one price.
CoreFit Gym takes no cut (`platform_settings.online_cut_bps` 0, Venkat 2026-10-30) and the app
shows no CoreFit Gym fee; the setting and math stay in case it returns. Fee math lives only in
`supabase/functions/_shared/fees.ts` (tests in `src/features/payments/__tests__/fees.test.ts`). No
refunds in the app.

**Offers and discounts** (owner only to set). A plan can carry a time-limited offer
(`membership_plans.offer_*`: 1–90% or a flat amount below the price, optional label, end date; set
in `membership-plan-editor`); members see the price struck through. The **loyalty offer**
(`gyms.loyalty_months`/`loyalty_percent`, `set_loyalty_offer()`, Payments → Loyalty offer, off by
default, app suggests 2 months / 10%) takes a percentage off any renewal once the member has paid
without a break for that many months (30 days each) up to the new start; breaks of up to 7 days are
forgiven and complimentary memberships don't count. It applies automatically. The two never stack:
the bigger discount wins. Percent discounts round to whole rupees. Online payments charge
`member_plan_price()` (`start_online_payment`; the offer name goes into `online_payments.offer` and
the membership note); the front desk gets the same price prefilled but can change it. App mirror:
`src/features/memberships/offers.ts` (keep both in step). **Saved offers** (`saved_offers`, owners and
supervisors) are announcements kept for reuse on New announcement; the plan editor's **Announce this
offer** opens it filled in.

**CoreFit Gym plan (owners pay us).** Each branch pays a yearly bill (fee + online add-on, now ₹0,
`branch_yearly_bill()`); `gyms.paid_until` is the last day covered. Owners pay on `subscription`
(Dashboard → CoreFit plan, from 30 days before the end): `create-subscription-payment` makes a
Razorpay Payment Link into CoreFit Gym's own account (no Route), and `razorpay-webhook` calls
`complete_subscription_payment()`, which adds a year from the day after `paid_until` (or today if
lapsed). The admin records cash on the branch screen (`admin_record_subscription`) or gives 1, 3, 6 or 12
free months (`admin_give_free_months`).
Unpaid (not free) branches: adding people stops on day one (`require_paid_branch` triggers on
`gym_invites` and `gym_members`, so every invite and import path is covered); every role sees
`PlanBanner` (only once unpaid, no advance warning); 5 days later (`branch_access()`, `GRACE_DAYS`) the app shows only `plan-locked` for
everyone at the branch, where the owner can pay. The lock is in the app only; the server still
answers other calls.

**Push and inbox.** Anything inserted into `notifications` (use `notify()`) shows in the inbox, and
a statement trigger posts it through `pg_net` to `send-push`, which sends via Expo push. The app
saves tokens with `register_push_token` in `use-push-notifications.ts`. Only call it when the
device token actually changed: re-registering from the token listener caused a loop of ~400k API
calls a day. Push needs a dev/preview build (not Expo Go on Android).

**Cron jobs** (`pg_cron`, scheduled inside migrations): `corefit-reminders` (`send_reminders`,
5 min: classes, sessions, membership expiry), `corefit-enquiry-reminders` (5 min),
`corefit-auto-check-out` (10 min), `corefit-purge-logs` (daily, trims cron and pg_net history).

## Conventions and gotchas

- **Name the FK in PostgREST embeds** when two paths join the same tables, for example
  `gym_members!gym_members_user_id_fkey(...)` or the workouts → profiles embed. An ambiguous embed
  fails with PGRST201 and breaks installed apps. Never add a second FK between `profiles` and
  `gym_members`.
- **Network failures** (no signal, a mobile network resetting the connection) reach screens as
  "Can't reach the server…" via `friendlyFetch` in `src/lib/network.ts`, the Supabase client's
  fetch. Show `error.message` as is; don't special-case raw fetch errors.
- **The app's Supabase URL is `https://api.vinven.net`,** a Cloudflare Worker (`infra/api-proxy/`)
  that forwards everything to the supabase.co project, because some Indian mobile networks reset
  connections to `*.supabase.co`. Keep `authStorageKey` (the old `sb-<ref>-auth-token`) so a URL
  change never signs people out. Server-side URLs (Vault `project_url`, Razorpay webhook) stay on
  supabase.co.
- **Every UPDATE/DELETE needs a WHERE clause,** even in RPCs. Supabase rejects them otherwise.
- **RLS on every new table,** plus a check in `supabase/tests/` for anything about who can see or
  change what. Keep migrations runnable on plain Postgres (guard `pg_cron`/`pg_net`/`vault` code).
- **Screens use `Screen`,** which gives pull-to-refresh and refetch-on-focus for free. Pass
  `refreshable={false}` on forms.
- **Headers:** every `Stack.Screen` needs a `title` (iOS back label). Gate screens without a back
  route (onboarding, profile-setup, enter-code, set-up-gym) use the native header (`headerShown: true`) so the title
  clears the Android status bar.
- **Copy:** keep in-app text crisp. One short line per hint, step or empty state; no paragraphs.
  Explanations belong in this file or the PR, not the UI (Venkat's rule).
- **Layout:** test at 360px wide and with large fonts (1.3x; demo on web at 277px). Use `useTheme()`
  colours only; `primary` is for fills, `accent` for green text. New dashboard shortcuts go in the
  `ShortcutGrid`, not as more full-width buttons.
- **Demo mode** (`npm run demo`) uses `src/lib/mock-db.ts`; keep the mock path working, and never
  show demo data in store builds.
- **Before saying done:** `npm run typecheck`, `npm run lint`, `npm test`. In the cloud container
  prefix Expo CLI with `EXPO_OFFLINE=1`; the container can't reach `*.supabase.co`, so real sign-in
  is tested on Venkat's phone.

## Shipping a change

Say in the PR which of these it needs:

- **`npx supabase db push`** for any new migration (run from Venkat's machine).
- **Function deploys** when `supabase/functions/` changes: `npx supabase functions deploy <name>`
  (`send-push`, `razorpay-webhook` and `join` need `--no-verify-jwt`).
- **A new EAS build** when a native module or `app.json` changes (`npx eas-cli@latest build
--profile preview` for the APK). JS-only changes need none.
- **Nothing** for `web/` changes: the dashboard redeploys itself on merge; run `cd web && npm run build` first.
- Email template edits must be pasted into Supabase → Authentication → Emails by hand.

## Keep this file current

Venkat's rule: any PR that adds or changes a business rule, a role or permission, a core flow, a
convention or gotcha, or what shipping needs must update this file in the same PR. Keep it
concise and derived from the code.

## Secrets

Never commit or paste secrets: Razorpay keys, webhook secrets, the service role key, push webhook
secret, Expo access token. They live in `npx supabase secrets set …` and Supabase Vault
(`project_url`, `push_webhook_secret`). The Supabase URL and anon key in `eas.json` and
`src/lib/env.ts` are public client values.
