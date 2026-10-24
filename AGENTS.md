This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## This project

- Gym app for three roles (member, trainer, owner). Routes live in `src/app/<role>/`; the root
  layout guards each role with `Stack.Protected`.
- Feature code lives in `src/features/<feature>/` (`types.ts`, `api.ts`, `hooks.ts`, `rules.ts`,
  `components/`, `__tests__/`). Keep screens thin and put logic in hooks and rules.
- `api.ts` functions fall back to `src/lib/mock-db.ts` when Supabase env vars are missing. Keep the
  mock path working when adding API calls.
- UI uses the single dark theme in `src/constants/theme.ts` and shared components in
  `src/components/` (Button, Card, Pill, ProgressBar, SectionHeader, StatTile). Keep tap targets at
  `TapTarget` or larger.
- Demo data is only allowed when `isDemoMode` is true (dev or `EXPO_PUBLIC_DEMO_MODE`); store
  builds must never show it. See `docs/RELEASE.md` before changing store-facing config.
- Schema changes go in a new file under `supabase/migrations/`, with RLS policies for every table.
- Run `npm run typecheck`, `npm run lint` and `npm test` before declaring a task done.
- In this cloud environment the Expo API is blocked by the proxy; prefix Expo CLI commands with
  `EXPO_OFFLINE=1`.
