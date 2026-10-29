// The join link in WhatsApp invites. WhatsApp only makes https links tappable,
// so the message links here and this sends the phone on to the app at
// corefit://join?code=…, or to the Play Store when the app isn't installed.
// Anyone can open it, so deploy without the JWT check:
//   npx supabase functions deploy join --no-verify-jwt
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.corefit.gym';

Deno.serve((req) => {
  const raw = new URL(req.url).searchParams.get('code') ?? '';
  const code = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  const appUrl = `corefit://join?code=${code}`;
  const ua = req.headers.get('user-agent') ?? '';
  // Android opens the app from an intent link and falls back to the store.
  const location = /android/i.test(ua)
    ? `intent://join?code=${code}#Intent;scheme=corefit;package=com.corefit.gym;S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`
    : appUrl;
  return new Response(null, {
    status: 302,
    headers: { Location: location, 'Cache-Control': 'no-store' },
  });
});
