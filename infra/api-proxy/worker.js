// api.vinven.net -> CoreFit Gym's Supabase project.
// Forwards every request as is (auth, rest, storage, functions, realtime websockets).
// On switch night to our own server, change UPSTREAM only; the app keeps api.vinven.net.
const UPSTREAM = 'suwvhennkhhtoutbcbti.supabase.co';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.protocol = 'https:';
    url.hostname = UPSTREAM;
    url.port = '';

    const headers = new Headers(request.headers);
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip) headers.set('X-Forwarded-For', ip);

    // redirect: 'manual' so the join link's redirect reaches the phone instead of being followed here.
    return fetch(url, {
      method: request.method,
      headers,
      body: request.body,
      redirect: 'manual',
    });
  },
};
