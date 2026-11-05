// Runs only for "/" (assets.run_worker_first); every other path is served
// straight from dist. On vinven.net the home page (about.html) is the front
// page; on dashboard.vinven.net "/" stays the owner dashboard.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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
