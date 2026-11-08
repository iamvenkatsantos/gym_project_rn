// Runs only for the paths in assets.run_worker_first ("/", /app, /join and the Apple and
// Google files); every other path is served straight from dist. On vinven.net the home page (about.html) is the front
// page; on dashboard.vinven.net "/" stays the owner dashboard.

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.corefit.gym';
// Set to the App Store link (https://apps.apple.com/app/id…) once the iOS app is live.
// Until then iPhones get the home page.
const APP_STORE_URL = null;
const HOME_URL = 'https://vinven.net/';
// Apple Team ID (developer.apple.com → Membership details), for iPhone universal links on
// vinven.net/join (app.json ios.associatedDomains). Until it's set, iPhones use the join page.
const APPLE_TEAM_ID = null;

const isAndroid = (ua) => /android/i.test(ua);
const isApple = (ua) => /iphone|ipad|ipod/i.test(ua);

/** The store for this phone: Play on Android, the App Store on iPhone, else the home page. */
function storeUrl(ua) {
  if (isAndroid(ua)) return PLAY_STORE_URL;
  if (isApple(ua) && APP_STORE_URL) return APP_STORE_URL;
  return HOME_URL;
}

/** Same rules as normalizeInviteCode in the app: 8 letters and digits. */
function inviteCode(raw) {
  return (raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

/**
 * The join page for iPhones without the app (with it, the universal link opens CoreFit before
 * this loads) and computers. It tries corefit://join, then offers the store and the code.
 */
function joinPage(code, ua) {
  const appUrl = `corefit://join?code=${code}`;
  const store = storeUrl(ua);
  const tryApp = isApple(ua) && code;
  const shown = code ? `${code.slice(0, 4)} ${code.slice(4)}` : '';
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <meta name="robots" content="noindex" />
    <title>Join your gym – CoreFit</title>
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="stylesheet" href="/site.css" />
  </head>
  <body>
    <main class="wrap">
      <h1>Join your gym on CoreFit</h1>
      ${code ? `<p class="lead">Your invite code: <strong>${shown}</strong></p>` : ''}
      <p><a href="${appUrl}">Open CoreFit</a></p>
      <p><a href="${store}">Get the app</a></p>
      <p>In the app, tap Sign in → I have an invite code.</p>
    </main>
    ${tryApp ? `<script>location.href = ${JSON.stringify(appUrl)};</script>` : ''}
  </body>
</html>`;
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ua = request.headers.get('user-agent') ?? '';
    // Google Search Console proof for vinven.net, answered here because the
    // assets layer would redirect *.html to the bare path.
    if (url.pathname === '/googled391fd8ca44bf63d.html') {
      return new Response('google-site-verification: googled391fd8ca44bf63d.html', {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
    if (url.hostname === 'www.vinven.net') {
      url.hostname = 'vinven.net';
      return Response.redirect(url.toString(), 301);
    }
    // The install link in invite and join messages: the right store for this phone.
    if (url.pathname === '/app') {
      return new Response(null, {
        status: 302,
        headers: { Location: storeUrl(ua), 'Cache-Control': 'no-store' },
      });
    }
    // iOS reads this to open vinven.net/join links in the app.
    if (url.pathname === '/.well-known/apple-app-site-association') {
      if (!APPLE_TEAM_ID) return new Response('Not found', { status: 404 });
      const appID = `${APPLE_TEAM_ID}.com.corefit.gym`;
      return Response.json({
        applinks: { details: [{ appIDs: [appID], components: [{ '/': '/join' }] }] },
      });
    }
    // The join link in invite messages (and where the join function sends iPhones and
    // computers). Android opens the app from an intent link and falls back to the store.
    if (url.pathname === '/join') {
      const code = inviteCode(url.searchParams.get('code'));
      if (isAndroid(ua)) {
        return new Response(null, {
          status: 302,
          headers: {
            Location: `intent://join?code=${code}#Intent;scheme=corefit;package=com.corefit.gym;S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`,
            'Cache-Control': 'no-store',
          },
        });
      }
      return joinPage(code, ua);
    }
    if (url.pathname === '/' && url.hostname === 'vinven.net') {
      return env.ASSETS.fetch(new Request(new URL('/about', url), request));
    }
    return env.ASSETS.fetch(request);
  },
};
