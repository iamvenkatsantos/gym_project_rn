# CoreFit Gym owner dashboard

A web dashboard for gym owners, on the same Supabase project as the app. Owners sign in with the
email and password they use in the app; anyone who doesn't own a gym is told to use the app instead.

| Page        | What it shows                                                                            |
| ----------- | ---------------------------------------------------------------------------------------- |
| Overview    | Members with an active plan, renewals due, money collected this month, today's check-ins |
| Members     | Every member with their latest plan and standing; filter, search, CSV                    |
| Payments    | Payments recorded in a period, totals by method, CSV                                     |
| Attendance  | Who came in on any day, and days present per person over 7, 30 or 90 days                |
| Check-in QR | The live front-desk display link (no sign-in) and the printable poster                   |
| Exports     | The payments, memberships and attendance CSVs from the app's Export reports              |

Owners of more than one gym pick the gym in the sidebar.

## Why a separate Vite app

The dashboard is a desktop tool full of tables, so it's a small React app built with Vite rather
than the Expo app running on the web:

- The mobile app's navigation, native modules (notifications, keyboard controller, secure storage)
  and phone-sized layouts would all need web stand-ins, and every mobile change would risk the
  dashboard.
- It builds to static files (`web/dist`) that any static host serves, and it deploys on its own
  schedule, with no EAS build or store review.
- It still shares code with the app: `@/` points at the app's `src/`, so CSV columns, membership
  status and report periods come from `src/features/reports` and `src/features/memberships`, and
  a fix there fixes both. Only pure files are shared, never React Native code.

## Security

There's no new backend. Every read goes through the RLS policies and owner-checked RPCs the app
already uses (`gym_people`, `memberships`, `export_payments`, `export_memberships`,
`export_attendance`, `gym_attendance`, `attendance_report`), so the dashboard can never show
more than the owner could see on their phone. The anon key in `src/lib/env.ts` is public.

## Running it

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest
npm run typecheck
npm run build      # static files in web/dist
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`) point it at another Supabase
project; by default it uses CoreFit's.

## Deploying

Any static host works. On Vercel, Netlify or Cloudflare Pages:

- Root directory: `web` (the build reads `../src`, so deploy from the whole repo, not a copy of `web/`)
- Build command: `npm install && npm run build`
- Output directory: `dist`

Pages live in the URL hash (`#/members`), so no rewrite rules are needed. Password sign-in needs no
Supabase change. Forgot password emails the same 6-digit code as the app.
