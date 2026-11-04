import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Over-the-air updates come from our own server (infra/updates-server), not EAS Update.
 *
 * Only builds whose eas.json profile sets APP_UPDATES_CHANNEL ask for updates:
 * preview → develop, production → main. Development and demo builds never do.
 * Publish with `npm run ota -- publish --channel <channel>` (see scripts/ota.mjs).
 */
const UPDATES_URL = 'https://updates.vinven.net/manifest';
const CERTIFICATE = './certs/certificate.pem';

export default ({ config }: ConfigContext): ExpoConfig => {
  const channel = process.env.APP_UPDATES_CHANNEL?.trim() || undefined;

  if (channel && !existsSync(join(__dirname, CERTIFICATE))) {
    throw new Error(
      `Missing ${CERTIFICATE}. Run "npx expo-updates codesigning:generate" first (see infra/updates-server/README.md).`,
    );
  }

  return {
    ...(config as ExpoConfig),
    updates: channel
      ? {
          enabled: true,
          url: UPDATES_URL,
          checkAutomatically: 'ON_LOAD',
          // Start at once with what's on the phone; a new update applies on the next launch.
          fallbackToCacheTimeout: 0,
          requestHeaders: { 'expo-channel-name': channel },
          codeSigningCertificate: CERTIFICATE,
          codeSigningMetadata: { keyid: 'main', alg: 'rsa-v1_5-sha256' },
        }
      : { enabled: false },
  };
};
