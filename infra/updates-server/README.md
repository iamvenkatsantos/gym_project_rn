# CoreFit Gym update server (`updates.vinven.net`)

Our own over-the-air (OTA) update server, used instead of EAS Update. Builds made from the
`preview` and `production` EAS profiles ask it for new JavaScript on every launch, so JS-only fixes
reach phones without a new APK or store review.

- **Protocol:** the [Expo Updates protocol](https://docs.expo.dev/technical-specs/expo-updates-1/)
  v1, the same one `expo-updates` uses with EAS. Android and iOS.
- **Where it runs:** a Cloudflare Worker (`src/worker.js`) with files in the R2 bucket
  `corefit-updates`. Free tier: 10 GB storage, no download fees, 100k Worker requests a day.
- **Moving to our own server later:** the same code runs on Node (`src/node.js`) with files in a
  folder. Copy the bucket over (`rclone copy r2:corefit-updates /srv/corefit-updates`), start
  `node src/node.js` behind HTTPS, and point `updates.vinven.net` at it. No app rebuild, because
  manifests use relative asset URLs and the signing key stays the same.
- **Security:** every manifest is signed on the publisher's machine with `keys/private-key.pem`.
  The app carries `certs/certificate.pem` and rejects anything not signed by that key. The server
  never sees the key; it only holds a publish token for uploads.

## How it fits together

| Piece                                               | What it does                                                    |
| --------------------------------------------------- | --------------------------------------------------------------- |
| `app.config.ts`                                     | Turns on `expo-updates` only when `APP_UPDATES_CHANNEL` is set  |
| `eas.json`                                          | `preview` → channel `develop`, `production` → channel `main`    |
| `app.json` `runtimeVersion: { policy: appVersion }` | An update reaches only builds with the same `expo.version`      |
| `scripts/ota.mjs` (`npm run ota`)                   | Exports, uploads, signs, publishes, lists and rolls back        |
| `src/server.js`                                     | Picks the update for platform + runtime + channel; serves files |

Development and demo builds never check for updates.

## One-time setup (Venkat)

Run these on your Mac from the repo root, on the PR branch.

1. **Make the signing key** (once, ever):

   ```bash
   npx expo-updates codesigning:generate \
     --key-output-directory keys \
     --certificate-output-directory certs \
     --certificate-validity-duration-years 10 \
     --certificate-common-name "CoreFit Gym"
   git add certs/certificate.pem && git commit -m "Add OTA update certificate" && git push
   ```

   `keys/` is git-ignored. Back up `keys/private-key.pem` in your password manager: if it's lost,
   installed apps can't take updates until they get a new build.

2. **Make a publish token** and keep it:

   ```bash
   openssl rand -hex 32
   ```

   Put it in `.env.ota.local` at the repo root (git-ignored):

   ```bash
   UPDATES_PUBLISH_TOKEN=<the token>
   ```

3. **Create the bucket and deploy the Worker** (logs into Cloudflare in the browser):

   ```bash
   cd infra/updates-server
   npx wrangler login
   npx wrangler r2 bucket create corefit-updates
   npx wrangler deploy                     # also creates the updates.vinven.net custom domain
   npx wrangler secret put PUBLISH_TOKEN   # paste the same token
   curl https://updates.vinven.net/health  # → ok
   ```

   If R2 asks you to enable it first: Cloudflare dashboard → R2 → Enable (free plan, card on file).

4. **Make one new build** (needs native `expo-updates`):

   ```bash
   npx eas-cli@latest build --profile preview --platform android --local
   ```

   Every later JS-only change ships with `npm run ota` instead of a build.

## Testing it (preview APK)

1. Install the APK from step 4 and open it once. Account shows `CoreFit 1.0.0`.
2. Change some visible text, commit it, then publish (from a branch other than `develop`, add
   `--force`):

   ```bash
   npm run ota -- publish --channel develop -m "Test OTA"
   ```

3. Close the app fully and open it: it downloads the update. Close and open again: the new text
   shows, and Account shows `CoreFit 1.0.0 · <first 6 characters of the update id>`.
4. Try a rollback: `npm run ota -- rollback --channel develop --embedded`, then close and open
   the app twice. The text is back to the build's own.

## Everyday use

```bash
npm run ota -- publish  --channel develop -m "Fix check-in button"   # from develop
npm run ota -- publish  --channel main    -m "Fix check-in button"   # from main (store builds)
npm run ota -- list     --channel main                               # what's live, last 20
npm run ota -- rollback --channel main                               # back to the previous update
npm run ota -- rollback --channel main --to <update id>              # back to a given update
npm run ota -- rollback --channel main --embedded                    # back to the build's own code
```

Add `--platform android` to publish one platform only, `--dry-run` to build and sign without
uploading.

- The script reads the env of the matching `eas.json` profile, so the update talks to the same
  Supabase URL as the build.
- Phones download on launch (and when brought back after an hour) and run the update on the next
  launch. If an update crashes on start, `expo-updates` falls back to the last one that worked.
- A rollback republishes the older update under a new id, because phones only take an update
  newer than the one they run.

## When a new build is needed instead

OTA only carries JavaScript and images. **Bump `expo.version` in `app.json` and make a new
build** whenever a change adds or updates a native module, changes native config in `app.json`
or `eas.json`, or upgrades the Expo SDK. The new version is a new runtime, so old builds never get
JS that needs native code they don't have. Store updates must stay within Apple's and Google's
rules: bug fixes and small changes over the air, new features through review.
