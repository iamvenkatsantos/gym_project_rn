# Releasing to the App Store and Google Play

Builds and submissions go through [EAS](https://docs.expo.dev/eas/). Native `ios/` and `android/`
folders are generated, so all native config lives in `app.json` and `eas.json`.

## Build profiles (`eas.json`)

| Profile       | Use                                           | Backend          | Distribution     |
| ------------- | --------------------------------------------- | ---------------- | ---------------- |
| `development` | Dev client for day-to-day work on a device    | CoreFit Supabase | Internal         |
| `preview`     | Installable test builds (APK, ad hoc iOS)     | CoreFit Supabase | Internal         |
| `demo`        | Sales / walkthrough builds with built-in data | Demo data        | Internal         |
| `production`  | Store builds; build numbers auto-increment    | CoreFit Supabase | App Store / Play |

The Supabase URL and anon key are set per profile in `eas.json`. Both are public client values;
the database's row-level security is what protects data.

Only the `demo` profile (and `npm run demo`) sets `EXPO_PUBLIC_DEMO_MODE=true` (`isDemoMode` in
`src/lib/env.ts`). Every other build, including store builds, opens on the real email sign-in.

```bash
npx eas-cli@latest login
npx eas-cli@latest init                       # links the project, adds projectId to app.json
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --profile production --platform ios
npx eas-cli@latest submit --profile production --platform android   # goes to the internal track
```

## Before the first submission

**Identity**

- [x] App name: CoreFit.
- [x] Bundle ID / package: `com.corefit.gym`. It can't change after the first upload to either
      store.
- [x] Icon, Android adaptive icon and splash generated from the CoreFit logo. A sharper master
      (vector or 1024px with an opaque white figure) would improve the store icon.
- [ ] Android themed (monochrome) icon: needs a single-colour version of the logo.

**Accounts**

- [ ] Apple Developer Program membership and an App Store Connect app record.
- [ ] Google Play Console account, app created, and a service account key for `eas submit`.
- [ ] New Play personal accounts must run a closed test with testers for 14 days before production
      access; plan for it.

**Policy requirements already handled in the app**

- [x] In-app account deletion (Account screen → Delete account), required by App Store guideline
      5.1.1(v) and Google Play. Deploy the function: `npx supabase functions deploy delete-account`.
- [x] Privacy policy and terms links in the app (Account screen).
- [x] `ITSAppUsesNonExemptEncryption: false`, so builds skip the export compliance question.
- [x] No demo or placeholder content in production builds.
- [x] Exercise demonstration photos are from Free Exercise DB
      (github.com/yuhonas/free-exercise-db), public domain under the Unlicense, bundled in
      `assets/exercises/` and credited under each demo. The dataset doesn't document where the
      original photos came from; replace them with your own footage if you want zero doubt.

**Still to do**

- [ ] Auth emails: custom SMTP, redirect URLs and `npx supabase functions deploy invite-member`
      (see "Inviting people and signing in" in the README).
- [ ] App Review sign-in: the app is invite-only, so create a member and a trainer account at a test
      gym and enter one in App Store Connect (App Review Information) and Play Console (App access).
- [ ] Publish a real privacy policy and terms, then update `src/constants/legal.ts` and the store
      listings. Play also needs a web page for account deletion requests.
- [ ] App Store privacy labels and Play Data safety form. Data collected today: name, email, gym
      bookings and membership history, all linked to the account, none used for tracking.
- [ ] A reviewer account (member role, with a membership and bookings) for App Review and Play's
      app access section, because every screen is behind sign-in.
- [ ] Store screenshots (6.9" iPhone and phone sizes for Play) and descriptions.
- [ ] Content rating questionnaire (Play) and age rating (App Store).
- [ ] If payments for memberships are added in the app, Apple and Google require their in-app
      purchase systems for digital goods; gym memberships used in person are usually exempt as
      physical services, but confirm before building checkout.
