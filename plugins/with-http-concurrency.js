// Lets Android run more API requests at once (perf audit, Venkat 2026-11-18).
//
// React Native's networking on Android uses one OkHttp client, whose dispatcher runs at most 5
// requests at a time to one host. Every API call goes to api.vinven.net, so a screen that starts
// 9-11 queries (Home, Training -> Coaching) made the rest wait in line: the timing log showed
// empty calls at 1.5 s and 3 s. This sets a client factory in MainApplication.onCreate that builds
// React Native's usual client (same cookie jar, cache and no timeouts, from
// OkHttpClientProvider.createClientBuilder) with a dispatcher allowing 16 per host.
// Native config: changing it needs a new build and an expo.version bump.
const { withMainApplication } = require('expo/config-plugins');

const MAX_REQUESTS_PER_HOST = 16;
const MAX_REQUESTS = 64;
const MARKER = '// corefit: http concurrency';

const IMPORTS = [
  'import com.facebook.react.modules.network.OkHttpClientFactory',
  'import com.facebook.react.modules.network.OkHttpClientProvider',
  'import okhttp3.Dispatcher',
];

function addImports(src) {
  const missing = IMPORTS.filter((line) => !src.includes(line));
  if (missing.length === 0) return src;
  // After the package line, so it works whatever the other imports are.
  return src.replace(/^(package [^\n]+\n)/m, `$1\n${missing.join('\n')}\n`);
}

function addFactory(src) {
  if (src.includes(MARKER)) return src;
  const call = 'super.onCreate()';
  const at = src.indexOf(call);
  if (at < 0)
    throw new Error('with-http-concurrency: super.onCreate() not found in MainApplication');
  const end = at + call.length;
  const block = `
    ${MARKER}: up to ${MAX_REQUESTS_PER_HOST} requests at once per host instead of OkHttp's 5.
    val httpContext = applicationContext
    OkHttpClientProvider.setOkHttpClientFactory(OkHttpClientFactory {
      OkHttpClientProvider.createClientBuilder(httpContext)
        .dispatcher(Dispatcher().apply {
          maxRequestsPerHost = ${MAX_REQUESTS_PER_HOST}
          maxRequests = ${MAX_REQUESTS}
        })
        .build()
    })`;
  return src.slice(0, end) + block + src.slice(end);
}

module.exports = function withHttpConcurrency(config) {
  return withMainApplication(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') {
      throw new Error('with-http-concurrency: expected a Kotlin MainApplication');
    }
    cfg.modResults.contents = addFactory(addImports(cfg.modResults.contents));
    return cfg;
  });
};

module.exports.addImports = addImports;
module.exports.addFactory = addFactory;
