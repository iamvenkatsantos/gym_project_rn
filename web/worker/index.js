// Runs only for "/" and the Google verification file (assets.run_worker_first); every other path is served
// straight from dist. On vinven.net the home page (about.html) is the front
// page; on dashboard.vinven.net "/" stays the owner dashboard.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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
    if (url.hostname === 'vinven.net') {
      return env.ASSETS.fetch(new Request(new URL('/about', url), request));
    }
    return env.ASSETS.fetch(request);
  },
};
