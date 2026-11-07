# CLAUDE.md

Guide for Claude sessions working on CoreFit. Read this first, then `AGENTS.md` (Expo rules and
code layout, imported below) and `README.md` (setup, push and Razorpay details).

@AGENTS.md

## What this is

CoreFit (product of VinVen Technologies) is one Expo app for gym members, trainers, supervisors
and owners, plus a platform admin who runs CoreFit itself. Bundle id `com.corefit.gym`, URL
scheme `corefit://`. The app is called **CoreFit** (`expo.name`, renamed from CoreFit Gym on
2026-11-03); some older server messages in migrations still say "CoreFit Gym". Android ships first; iOS push (APNs) is not set up yet.

- **App:** Expo SDK 58, Expo Router (`src/app/`), TypeScript strict, TanStack Query for server
  state, Zustand for the auth session and offline drafts.
- **Backend:** Supabase. Postgres with RLS on every table, most writes through `security definer`
  RPCs, edge functions in `supabase/functions/`, `pg_cron` + `pg_net` for jobs and push.
- **Owner web dashboard:** a separate Vite app in `web/` that reuses pure files from `src/` (see
  `web/README.md`). Live at `https://dashboard.vinven.net` (Cloudflare Workers Builds, deploys on
  push to `main`). Never import React Native code into it. No QR on the web.
- **Public pages:** plain HTML in `web/public/` served by the same worker, no sign-in:
  the home page `about.html` (features with app screenshots in `img/`, pricing; it is the front
  page of `https://vinven.net` via `web/worker/index.js`, which runs only for `/`; `www` redirects
  to it; on `dashboard.vinven.net` `/` stays the dashboard, marked `noindex`), `/privacy`, `/terms`,
  `/support` and `/delete-account` (Play's deletion URL). Canonical URLs and `sitemap.xml` use
  `vinven.net`. The app links them from `src/constants/legal.ts`;
  support email is `support@vinven.net` (Cloudflare Email Routing). Update them when pricing,
  data collected, service providers or the delete flow change.

## Folder map

| Path                         | What lives there                                                                                                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/_layout.tsx`        | Root navigator: every gate and role is a `Stack.Protected` guard                                                                                                             |
| `src/app/<role>/`            | Tab areas: `member`, `trainer`, `supervisor`, `owner`, `admin`                                                                                                               |
| `src/app/*.tsx`, `[id]` dirs | Shared stack screens (person, plan-editor, record-membership, check-in, …)                                                                                                   |
| `src/features/<feature>/`    | `types.ts`, `api.ts`, `hooks.ts`, `rules.ts`, `components/`, `__tests__/`                                                                                                    |
| `src/components/`            | Shared UI: `Screen`, Button, Card, ListRow, StatTile, ShortcutGrid, TextField, …                                                                                             |
| `src/constants/theme.ts`     | Light/dark tokens, `TapTarget`, `MaxFontScale`                                                                                                                               |
| `src/lib/`                   | `supabase.ts`, `env.ts` (`isDemoMode`), `mock-db.ts`, `query-client.ts`                                                                                                      |
| `supabase/migrations/`       | One timestamped file per change; never edit a pushed migration                                                                                                               |
| `supabase/functions/`        | `invite-member`, `accept-invite`, `reset-password`, `join`, `import-members`, `send-push`, `create-payment`, `razorpay-webhook`, `delete-account`; shared code in `_shared/` |
| `supabase/tests/`            | SQL checks run on plain Postgres (see README "Database checks")                                                                                                              |
| `supabase/templates/`        | Auth email templates, pasted into Supabase by hand                                                                                                                           |
| `infra/api-proxy/`           | Cloudflare Worker behind `api.vinven.net`, the app's Supabase URL; pasted into Cloudflare by hand, plus a WAF rate-limit rule (its README)                                    |
| `infra/updates-server/`      | Our over-the-air update server on `updates.vinven.net` (Worker + R2, also runs on Node); deployed with `npx wrangler deploy`                                                 |
| `scripts/ota.mjs`            | `npm run ota`: publish, list and roll back over-the-air updates                                                                                                              |

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
  **Make this branch free** on the admin branch screen or when adding one). Members use their home
  branch, except that an **All branches** plan lets them check in at any branch of the brand (see
  Attendance).
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
**Admission details, both places:** on a member invite the inviter picks **They fill in** (default)
or **Fill in now** (name, mobile, date of birth, weight, height; all required). The app then calls
`save_admission_details()`, which keeps them on the `gym_invites` row (trainers only on invites they
sent) or, for someone added straight away with an account, applies them now. On joining,
`claim_gym_invites` applies them via `apply_admission_details()` (never overwrites a name, mobile or
DOB they already have; weight/height become the first measurement) and sets `onboarded_at`, so the
member skips `onboarding` and lands on Home. Fill in now also takes the front, side and back
photos (`StartingPhotos`, required in the app): the inviter uploads them to
`<gym>/admissions/<folder>/` in `progress-photos` (staff-only insert policy; readable once they're a
member's `progress_photos`), they're kept in `gym_invites.photo_paths` and become the member's first
progress photos on join. The join screen prefills the inviter's name (`invite_by_code.full_name`).
**WhatsApp invites without an email:** the email is optional on WhatsApp. Without one the account's
email is `<10 digits>@m.vinven.net` (`mobile_login_email()`, a domain with no mail), and the person
signs in with their mobile number: Sign in takes "Email or mobile" and `signInEmail()` maps a mobile to
that address (`src/lib/mobile-login.ts`; show it with `loginLabel()`, never raw). **Their password
reset** (Venkat, 2026-11-04, both ways): owners and supervisors tap **Send password reset code** on
the person screen (`create_password_reset_code()`, mobile logins only so nobody takes over an email
account, 1 day, works once) and send it on WhatsApp; the person taps Forgot password? with their
mobile → **I have a reset code** → `reset-password` screen and edge fn, which also signs them out
on every other device (`end_user_sessions()`, service role only). Or they add an email on
Edit profile (`AddEmail`, `updateUser` + `verifyOtp` type `email_change`; needs Supabase "Secure
email change" off) and sign in with it from then on.
**Invite by email**: the `invite-member` edge fn calls
`invite_to_gym()` (or, for an older new-gym invite, `invite_gym_owner()`) as the caller, then sends the
email with the service role. Supervisors invite members and trainers; trainers invite members only,
and those members are auto-mapped to them. Every member invite records an admission
(`gym_members.admitted_by` / `admitted_at`, frozen by trigger). Emails carry a 6-digit code
(`enter-code`, `verifyOtp`) because links can't open the app from a computer. `claim_gym_invites`
attaches pending invites when the user confirms. Pending invites list as **Invited** on People, and
members who haven't confirmed an account (imported) show an Invited tag (`gym_people.signed_up`).
**No trainer or plan before they join:** `member_trainers_signed_up` trigger, `isSignedUp()` in the
pickers. Login is email + password, or mobile + password for WhatsApp invites without an email (no phone OTP); Google or other
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
phone, date of birth, weight, height, front/back/side photos via `complete_member_onboarding`,
optional profile photo; skipped when the inviter filled in admission details); anyone else without a mobile number (`Profile.phone === null`, mostly staff, via
`selectNeedsProfile`) → `profile-setup` (name, required mobile, optional photo via `save_my_profile`);
no gym →
`no-gym` (older new-owner invites → `set-up-gym`, `create_gym`); admin → `admin`; otherwise the
role's area. Roles and profile refetch when the app comes to the foreground.

**Profiles.** Every role must have a mobile number (in `contact_details`, readable only by the
person, their gym's managers and, for members, their mapped trainers) and may add a profile photo.
Photos live in the public `avatars` bucket at `<user id>/<random>.<ext>` (`profiles.avatar_path`,
checked to sit in the person's own folder); progress photos stay private. Anyone edits their photo,
name and mobile on `edit-profile` (tap the profile card, or Edit profile on Profile/Account). Use
`TrainerAvatar` with `url` to show a photo with initials as the fallback. The person screen has
**Call** and **WhatsApp** buttons from the mobile on file (`callUrl`, `whatsappUrl`).

**Birthdays.** Date of birth lives in `contact_details.date_of_birth` (same readers as the mobile).
Members give it on the first-sign-in form (required; the 6-argument `complete_member_onboarding`,
the 5-argument one stays for older installs); anyone can change theirs on `edit-profile`
(optional, 4-argument `save_my_profile`); owners and supervisors add or fix a member's on the
person screen (`set_member_birthday`, only once the member has a mobile on file). DOB is typed as
DD/MM/YYYY (no native date picker, so no new build). `gym_people` returns it. On the day (the gym's
day; 29 Feb falls on 28 Feb in other years, `is_birthday()`), owners and supervisors get a 9 am push
(`send_birthday_reminders`, kind `birthday`, opens `birthdays`) and wish members from the
**Birthdays** shortcut or the person screen: **Send wish** (`send_birthday_wish`, inbox + push, only
on the birthday, once a year per gym) or **WhatsApp** (`birthdayMessage`). Rules in
`src/features/birthdays/rules.ts`.

**Attendance and QR.** Members and staff check in/out from Home. Members must be checked in to start
a workout (`start_workout_attendance` raises "Check in first"). **No membership, no training:** a
member needs a membership covering today (`has_current_membership()`, the gym's day) to check in
(button or QR), start a workout, book a class or book a trainer; `require_membership()` raises "No
active membership…" in `check_in`, `scan_check_in` (checking out still works),
`start_workout_attendance`, `book_class` and `book_trainer_session`. Staff never need one. The app
mirrors it with `useHasMembership` and `NoMembershipNotice`. A paused day doesn't count (see
Membership pause below). New members are blocked until their
first membership is recorded. Each branch has a QR
(`corefit://check-in?gym=…&code=…`): a rotating live code on the owner's `check-in-display` and a
fixed poster code the admin shares as an image. `scan_check_in` toggles in/out;
**All-branch plans** (Venkat, 2026-11-06): owners with 2+ branches set a plan's **Works at** to All
branches (`membership_plans.all_branches`). Its members stay members of their home branch (they pay
there, so the money goes to that branch's Razorpay account) but can scan the QR at any branch of
the brand (`branch_pass_home()`; `has_current_membership()` counts it). The visit is an
`attendance` row at that branch; Home shows it with the branch name (`my_attendance_today`),
Check out and Start workout work from home, the workout counts on the visit, and checking in
anywhere closes an open visit elsewhere in the brand. That branch's attendance lists them with
"From <home branch>" (`gym_attendance.home_branch`). Classes and trainer bookings stay at home.
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
permission counts as time worked. **Late streaks** (`set_trainer_late_rule()`, saved after the
hours; null `late_after_minutes` = off): a first check-in more than N minutes after the branch's
`opens_at` is late, unless approved permission starts by then; every `late_streak_days` late working
days in a row cost `late_lop_minutes` on the day the streak completes, then the count restarts (off
days skipped; on-time or absent days reset; streaks count within the month; branches open 24 hours
have no late). Late LOP adds to shortfall LOP. **Evening shift** (Venkat, 2026-11-02): owners set
`trainer_hour_rules.evening_starts_at` (`set_evening_shift_start()`, null = none) and mark evening
trainers in Rules (`trainer_shifts`, `set_trainer_shift()`, owner-only, saved on tap; unlisted =
morning). Evening trainers are late against the evening start, everyone else against opening.
`trainer_hours_month()` returns the days (with first check-in, permission start, opening and the
trainer's shift start, as minutes after midnight); the LOP maths is
`applyRules`/`applyLateStreaks`/`summariseMonth` in `src/features/trainer-hours/rules.ts`. LOP is in hours; the app
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
**Weekday plans:** on `assign-plan` the coach picks each member's days
(`workout_assignments.days`, ISO 1 = Mon … 7 = Sun; empty = any day). Members see **Today**
(due, catch-up or any-day plans, startable) and **This week** (not startable). A missed day stays
open for the gym's catch-up days (`gyms.workout_catch_up_days`, 0–3, default 1, set by owners and
supervisors on Training → Coaching via `set_workout_catch_up_days()`) unless the member already
logged that plan since. App-only rule (`src/features/workouts/schedule.ts`); the server doesn't block.
**Smart plans:** 15 ready-made plans, 5 per level (`src/features/workouts/smart-plans.ts`, shared
library exercises only, matched to the DB by name); coaches copy one from My plans → **Smart plans**
into `plan-editor`, then assign. **Stretches:** plan cards and `workout-session` show cool-down
stretches for the plan's muscles (`stretches.ts`, max 6, app-only, not in the exercise library),
each with a looping thumb that opens a full demo (photos in `assets/stretches/`, `stretch-demos.ts`,
same Free Exercise DB source; a test checks every stretch has one).
Exercises are added on the `add-exercises` modal (search pinned on top, so the keyboard never
covers results); picks go back to the editor through `useExercisePicks`.
**Self workouts** (Venkat, 2026-11-01): only a member's own mapped coaches switch it on for them
(member progress → **Self** tab, `set_self_workouts()`, `member_trainers.self_workouts`; any one
coach's switch counts, `self_workouts_on()`). The member then answers goal, level, 3–6 days and
split on `self-plan-setup`, and the app builds the week from the smart plans (`buildSelfPlans` in
`src/features/self-workouts/rules.ts`: a rotation per level and split, a 4+ day week's last day
goes to the goal, losing weight shortens rests) and saves it with `create_self_plan()`, which
replaces their old own plans. Own plans are `workouts` rows with `is_self = true` and
`trainer_id` = the member, assigned to themselves with their days, so they show in Today / This
week; `self-plan` shows the week by day. Saving goes only through `save_self_workout()` /
`delete_self_workout()`: the member while it's on, their coaches always (a coach's edit tells the
member). The member's coaches and managers see own plans (`can_view_workout`), and coaches can
also map their own plans from the Self tab. Switched off, own plans are hidden from the member
and read-only for them. **After every workout** members answer a self-check on `workout-session`
(effort 1–10 required, pain spot, note; `workout_logs.effort/pain/note`), which the "finished a
workout" push to their trainers carries. Swaps from **Replace** (same-muscle pick) are logged in
`workout_logs.swaps`. A coach or manager replies once (`reply_to_workout()`, inbox kind
`workout`); a trigger stops members writing the reply.
**Weekly goal ring** (Venkat, 2026-11-06): members' Plans tab shows days trained this week
against a goal, with a streak (`WeeklyGoalCard`, `src/features/progress/goal.ts`, app-only). The
goal is the distinct weekdays of the member's assigned plans (own plans count while self workouts
are on, so it's the days they picked), or 3 when none have days; a day counts once; the streak is
weeks in a row that met today's goal, and this week adds only once met. The ring is plain views
(`ProgressRing`, no SVG), so it ships over the air.
**Live workout** (Venkat, 2026-11-03): `workout-session` opens on **Live** (`LiveWorkout`,
`src/features/progress/live.ts`): one exercise at a time with its demo, how-to steps and set dots;
reps, kg (2.5 kg steps, 0 = bodyweight) and **Done** pinned at the bottom; a full rest screen with
+15s, Skip and Up next; an exercise's last set moves on by itself; the screen stays awake. After
the last set the plan's stretches follow as a **Cool-down** (`CoolDown`, one per screen with its
demo, each side separately, a Start/Skip/Next hold timer; not logged). **How did it go?** (the
self-check) shows only at the very end, after the cool-down, or when a member taps Finish early.
Finishing goes back to where workouts start (members: Workouts tab); the draft is cleared only
after leaving the screen, because clearing it first unmounts the session before it can navigate. The
header says **Workout**; the elapsed time shows as "Workout time" under the plan name.
**All exercises** keeps the old list.

**Memberships and payments.** Owners set plans (`membership-plan-editor`); owners and supervisors
record cash/UPI payments and renewals (`record-membership`) and chase renewals (`renewals`,
`remind_renewal` push, or a WhatsApp button with a written message from `renewalMessage`). Online
payments are switched on per branch by the admin and cost the owner nothing extra
(`platform_settings.online_addon_cents` 0, Venkat 2026-10-30; the add-on math stays): `create-payment` makes a Razorpay Payment Link
opened in the in-app browser (no native SDK), `razorpay-webhook` verifies the signature and calls
`complete_online_payment()`, and the browser returns to `corefit://payment-return`. The gym's share
goes to the owner's Razorpay **Route** linked account (`gyms.razorpay_account_id`); member money
never stays with CoreFit. By default the owner pays all fees and the members see one price.
CoreFit takes no cut (`platform_settings.online_cut_bps` 0, Venkat 2026-10-30) and the app
shows no CoreFit fee; the setting and math stay in case it returns. Fee math lives only in
`supabase/functions/_shared/fees.ts` (tests in `src/features/payments/__tests__/fees.test.ts`). No
refunds in the app. **Receipts** (Venkat, 2026-11-07): every membership with money paid (not
complimentary, `is_paid_membership()`) gets a receipt number counted per branch from 1
(`memberships.receipt_no`, set once by the `memberships_number_receipt` trigger from
`gyms.last_receipt_no`, which apps can't read). `membership_receipt()` returns it with the branch's
name, address and phone (Gym details) for the member or the branch's owners and supervisors. The
`receipt` screen previews it on its A5 PDF page (print colours) and shares it as a PDF or an image
(`share-receipt.ts`: view-shot JPEG wrapped by `imagePdf()` in `src/lib/image-pdf.ts`, plain JS so
no print module or new build; text if that fails); payment history rows, the online payment screen and `record-membership` (after
a paid entry) open it. It says "not a tax invoice": no GST or GSTIN. **Test keys block payments** (`testModeBlock` in `_shared/razorpay.ts`): while
`RAZORPAY_KEY_ID` is `rzp_test_…`, `create-payment` and `create-subscription-payment` refuse everyone
but platform admins ("opens soon"), because a test payment still records a membership or a paid
year. Live keys lift it with no build or deploy; `RAZORPAY_TEST_PAYMENTS=open` lifts it for staging.

**Member rules** (Venkat, 2026-11-06; owner only, Payments → **Member rules**, `set_member_rules()`,
columns on `gyms`). **Membership pause:** off until the owner sets `pause_max_days` (0 = off, up
to 90 days per membership in total; app suggests 15). The member pauses on Profile, or owners and
supervisors on the person screen (`pause-membership`, `pause_membership()`): one pause at a time,
starting today or within 30 days, on the membership covering its first day. The membership (and any
early renewal after it) ends that many days later; class bookings and trainer sessions inside the
pause are cancelled; `has_current_membership()` is false on paused days (`is_paused()`), so no
check-in, workouts or bookings. **Resume now** / **Cancel pause** (`end_pause()`) gives back the
unused days. Pauses live in `membership_pauses`; app rules in `src/features/memberships/pause.ts`.
**Class waitlist:** a full class takes a waitlist (`bookings.status = 'waitlisted'`, queued by
`waitlisted_at`; `book_class()` decides). When a booked spot frees up (cancel, pause, capacity
raised) `fill_from_waitlist()` books the next person with a current membership and pushes "You're
in". Members see their place (`my_waitlist_positions()`); cancelling a class clears its waitlist.
**Booking cap:** `class_booking_cap` (null = no limit) caps upcoming classes a member holds,
waitlists included. **Referrals:** members tap Profile → **Refer a friend** (`refer_friend()`):
the friend becomes an enquiry (source referral, `enquiries.referred_by`, assigned to an owner,
else a supervisor) and the member can WhatsApp them. The branch's owners and supervisors and the
member's own trainers get a "New referral" push whose inbox card has **Call** and **WhatsApp**
(`notifications.phone`; Venkat, 2026-11-07). They also see the last 14 days on **Referrals**
(dashboard shortcut for managers, trainer Home; `gym_referrals()`: managers see all, trainers only
their own members' referrals). Already at
the gym or already an open enquiry (matched on the last 10 digits of the mobile) is refused; 10 a
day max. When the friend's first paid (not complimentary) membership is recorded, matched by linked
enquiry or mobile and only if they joined after the referral, `reward_referral()` gives the referrer
`referral_reward_days` free days (0 = none, off by default) on their running membership, or on their
next one (`referral_rewards.applied_at`). Members see their referrals via `my_referrals()`.

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

**CoreFit plan (owners pay us).** Each branch pays a yearly bill (fee + online add-on, now ₹0,
`branch_yearly_bill()`); `gyms.paid_until` is the last day covered. Owners pay on `subscription`
(Dashboard → CoreFit plan, from 30 days before the end): `create-subscription-payment` makes a
Razorpay Payment Link into CoreFit's own account (no Route), and `razorpay-webhook` calls
`complete_subscription_payment()`, which adds a year from the day after `paid_until` (or today if
lapsed). The admin records cash on the branch screen (`admin_record_subscription`) or gives 1, 3, 6 or 12
free months (`admin_give_free_months`).
Unpaid (not free) branches: adding people stops on day one (`require_paid_branch` triggers on
`gym_invites` and `gym_members`, so every invite and import path is covered); every role sees
`PlanBanner` (only once unpaid, no advance warning); 5 days later (`branch_access()`, `GRACE_DAYS`) the app shows only `plan-locked` for
everyone at the branch, where the owner can pay. The lock is in the app only; the server still
answers other calls.

**Push and inbox.** Anything inserted into `notifications` (use `notify()`) shows in the inbox, and
a statement trigger posts it through `pg_net` to `send-push`, which sends via Expo push. The inbox
shows **Today** plus **Earlier** unread ones (Venkat, 2026-11-06): opening it marks all read, and
older ones drop off from the next day (`inInbox`, phone's day; read today = kept until midnight). The app
saves tokens with `register_push_token` in `use-push-notifications.ts`. Only call it when the
device token actually changed: re-registering from the token listener caused a loop of ~400k API
calls a day. Push needs a dev/preview build (not Expo Go on Android).
**Automatic pushes** (besides reminders, bookings, birthdays and announcements; Venkat, 2026-11-06,
`20261106050000_extra_notifications.sql`, all on existing kinds so older apps show them): a coach
assigns a plan → member "New workout plan" (not own plans); a membership with money paid →
"Payment received" with the amount (`rupees()`; free ones stay "Membership active"); a member drops
a future class → its trainer; a joined invite → the inviter "New member joined" (trainer invites
skip it, the mapping's "New member" covers them). `send_member_nudges` (from 10 am gym time, once
each by `dedupe_key`): **We miss you** when the last check-in was 7–13 days ago and they still have
a membership (mapped trainers get "Member missing"), and **Time to measure** at most monthly when
an onboarded member has logged no measurement at that gym for 30 days.

**Over-the-air updates** (self-hosted, not EAS Update; Venkat 2026-11-04). `expo-updates` talks
to our own server at `updates.vinven.net/manifest` (`infra/updates-server/`, the Expo Updates
protocol v1 on a Cloudflare Worker with the R2 bucket `corefit-updates`; the same code runs on Node
for a later move to our own server). Only builds whose `eas.json` profile sets `APP_UPDATES_CHANNEL`
ask for updates (`app.config.ts`): `preview` → channel `develop`, `production` → `main`; development
and demo builds never do. `runtimeVersion` is `appVersion`, so an update reaches only builds with the
same `expo.version`: **bump `expo.version` whenever native code or native config changes**, and make
a new build. Publish from the matching branch with `npm run ota -- publish --channel develop|main`;
the script exports with that profile's `eas.json` env, uploads content-addressed files, and signs
each manifest with `keys/private-key.pem` (git-ignored, on Venkat's Mac only; the app ships
`certs/certificate.pem` and rejects unsigned updates). `npm run ota -- rollback` republishes the
previous update under a new id (phones only take newer ones) or, with `--embedded`, sends phones
back to the build's own code. `npm run ota -- prune --yes` frees storage (keeps the last 5
updates per channel and the files they use; never delete R2 files by hand). Phones download on launch (and on return to the front, hourly, via
`useOtaUpdates`) and apply on the next launch; Account shows the running update's short id. Setup
and test steps: `infra/updates-server/README.md`.

**Cron jobs** (`pg_cron`, scheduled inside migrations): `corefit-reminders` (`send_reminders`,
5 min: classes, sessions, membership expiry), `corefit-enquiry-reminders` (5 min),
`corefit-auto-check-out` (10 min), `corefit-birthdays` (hourly, managers' 9 am birthday push),
`corefit-nudges` (hourly, `send_member_nudges`),
`corefit-purge-logs` (daily, trims cron and pg_net history).

## Conventions and gotchas

- **Name the FK in PostgREST embeds** when two paths join the same tables, for example
  `gym_members!gym_members_user_id_fkey(...)` or the workouts → profiles embed. An ambiguous embed
  fails with PGRST201 and breaks installed apps. Never add a second FK between `profiles` and
  `gym_members`.
- **Network failures** (no signal, a mobile network resetting the connection) reach screens as
  "Can't reach the server…" via `friendlyFetch` in `src/lib/network.ts`, the Supabase client's
  fetch. Show `error.message` as is; don't special-case raw fetch errors.
- **CSV and the byte order mark:** `toCsv` starts with a UTF-8 BOM so desktop Excel (the web
  dashboard's downloads) reads Tamil names and ₹. The app's `shareCsv` strips it, because Google
  Sheets on Android shows it as "ï»¿" before the first header.
- **The app's Supabase URL is `https://api.vinven.net`,** a Cloudflare Worker (`infra/api-proxy/`)
  that forwards everything to the supabase.co project, because some Indian mobile networks reset
  connections to `*.supabase.co`. Keep `authStorageKey` (the old `sb-<ref>-auth-token`) so a URL
  change never signs people out. Server-side URLs (Vault `project_url`, Razorpay webhook) stay on
  supabase.co.
- **Sessions:** supabase-js keeps the session (access JWT, 1 hour, plus a refresh token) in
  AsyncStorage under `authStorageKey` and refreshes it only while the app is in the foreground.
  `signOut()` is global (revokes the refresh tokens on every device). Removing or suspending
  someone takes effect on their next request, because RLS checks `gym_members.status`.
- **Views run as the caller:** create every view `with (security_invoker = on)` so RLS applies
  (the advisor flags definer views as critical). Counts the caller's RLS hides go through a small
  `security definer` function, like `class_booking_count()`. Revoke execute from `public, anon`
  on every `security definer` function and grant only what the app calls; trigger functions get no
  grants at all.
- **The API proxy forwards only** `/auth/v1/`, `/rest/v1/`, `/storage/v1/`, `/functions/v1/` and
  `/realtime/v1/`; sign-in and code entry are rate limited by a Cloudflare WAF rule
  (`infra/api-proxy/README.md`). Edge functions without a JWT check (`join`, `send-push`,
  `razorpay-webhook`, `accept-invite`, `reset-password`) must validate and cap every input.
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

- **`npx supabase db push --remote`** for any new migration (run from Venkat's machine; the CLI now targets a local database without `--remote`).
- **Function deploys** when `supabase/functions/` changes: `npx supabase functions deploy <name>`
  (`send-push`, `razorpay-webhook` and `join` need `--no-verify-jwt`).
- **A new EAS build** when a native module or `app.json` native config changes (`npx eas-cli@latest
build --profile preview` for the APK), with `expo.version` bumped. JS-only changes need none:
  ship them with **`npm run ota:dev`** (from `develop`) or **`npm run ota:prod`** (from `main`,
  after the release merge); add `-- -m "what changed"`. Store builds: `npm run build:prod`.
- **`cd infra/updates-server && npx wrangler deploy`** when `infra/updates-server/` changes.
- **Nothing** for `web/` changes: the dashboard redeploys itself on merge; run `cd web && npm run build` first.
- Email template edits must be pasted into Supabase → Authentication → Emails by hand.

## Keep this file current

Venkat's rule: any PR that adds or changes a business rule, a role or permission, a core flow, a
convention or gotcha, or what shipping needs must update this file in the same PR. Keep it
concise and derived from the code.

## Secrets

Never commit or paste secrets: Razorpay keys, webhook secrets, the service role key, push webhook
secret, Expo access token, the OTA signing key (`keys/private-key.pem`) and publish token
(`.env.ota.local`, Worker secret `PUBLISH_TOKEN`). They live in `npx supabase secrets set …` and Supabase Vault
(`project_url`, `push_webhook_secret`). The Supabase URL and anon key in `eas.json` and
`src/lib/env.ts` are public client values.
