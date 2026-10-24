# Gym App

A React Native app for gym members, trainers and owners. One app, three roles: each user
lands in their own area after signing in.

| Role    | What they can do today                                            |
| ------- | ----------------------------------------------------------------- |
| Member  | See their membership, browse workouts, book and cancel classes    |
| Trainer | See their class schedule and the workouts they've written         |
| Owner   | Dashboard of members and bookings, all classes, members and plans |

## Stack

- **Expo SDK 58** with **Expo Router** (file-based routes, protected per role)
- **TypeScript** (strict)
- **TanStack Query** for server state, **Zustand** for the auth session
- **Supabase** for auth and Postgres, with row-level security per gym and role
- **Jest** + **React Native Testing Library**, ESLint (`eslint-config-expo`), Prettier

## Getting started

```bash
npm install
npm start          # then press i, a or w
```

Without Supabase credentials the app runs on in-memory demo data, and the sign-in screen
lets you continue as a member, trainer or owner.

To use a real backend, copy `.env.example` to `.env`, fill in your project's URL and anon key,
and apply the schema:

```bash
npx supabase link --project-ref <your-ref>
npx supabase db push
```

New sign-ups get a `member` profile with no gym. Set `gym_id` and `role` on `profiles` to put
someone in a gym or make them a trainer or owner.

## Scripts

| Command             | What it does              |
| ------------------- | ------------------------- |
| `npm start`         | Start the Expo dev server |
| `npm test`          | Run Jest                  |
| `npm run typecheck` | `tsc --noEmit`            |
| `npm run lint`      | ESLint via `expo lint`    |
| `npm run format`    | Prettier                  |

## Project structure

```
src/
  app/                    Routes (Expo Router). Every file is a screen.
    _layout.tsx           Providers and role guards
    sign-in.tsx
    member/               Member tabs: home, classes, workouts, membership
    trainer/              Trainer tabs: schedule, workouts
    owner/                Owner tabs: dashboard, classes, members
  features/
    auth/                 Session store, sign-in/out, profile
    workouts/             types, api, hooks, components, tests
    bookings/             classes, bookings, booking rules
    memberships/          plans, memberships, status rules
  components/             Shared UI (Screen, Card, Button, QueryState, tabs)
  lib/                    Supabase client, query client, env, formatting, mock data
  constants/ hooks/       Theme tokens and theme hooks
supabase/migrations/      Database schema and RLS policies
```

Each feature keeps the same shape: `types.ts` for the domain model, `api.ts` for Supabase calls
(mapping snake_case rows to camelCase types, with a mock fallback), `hooks.ts` for React Query
hooks and keys, pure business rules in `rules.ts`, and its own `components/`.
