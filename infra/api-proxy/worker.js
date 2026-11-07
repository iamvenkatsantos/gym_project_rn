// api.vinven.net -> CoreFit Gym's Supabase project.
// Forwards the Supabase APIs the app and dashboard use (auth, rest, storage, functions, realtime
// websockets); anything else (GraphQL, other paths) gets a 404 so it isn't reachable through
// our domain. On switch night to our own server, change UPSTREAM only; the app keeps api.vinven.net.
// Rate limits for sign-in and code entry are a Cloudflare WAF rule on this host (see README.md).
const UPSTREAM = 'suwvhennkhhtoutbcbti.supabase.co';

const ALLOWED_PREFIXES = [
  '/auth/v1/',
  '/rest/v1/',
  '/storage/v1/',
  '/functions/v1/',
  '/realtime/v1/',
];

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (!ALLOWED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
      return new Response('Not found', { status: 404 });
    }
    url.protocol = 'https:';
    url.hostname = UPSTREAM;
    url.port = '';

    const headers = new Headers(request.headers);
    // Supabase's own rate limits count per client, so pass the phone's address, never one the
    // caller made up.
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip) headers.set('X-Forwarded-For', ip);
    else headers.delete('X-Forwarded-For');

    // redirect: 'manual' so the join link's redirect reaches the phone instead of being followed here.
    return fetch(url, {
      method: request.method,
      headers,
      body: request.body,
      redirect: 'manual',
    });
  },
};
