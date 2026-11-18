// Raises Android's cap on simultaneous requests to one host (perf audit, 2026-11-18).
//
// React Native's networking uses OkHttp, whose dispatcher runs at most 5 requests at once per
// host. Every API call goes to api.vinven.net, and a screen such as Training starts 9, so calls
// 6 to 9 wait for earlier ones and the timing log counts that wait (0-row calls at 1.5 s and 3 s).
// This sets a roomier limit in MainApplication.onCreate through React Native's client factory,
// before any request is made. Native config, so it needs a new build (bump expo.version).
const { withMainApplication } = require('expo/config-plugins');

const MAX_PER_HOST = 16;
const MAX_TOTAL = 64;

const IMPORTS = [
  'import com.facebook.react.modules.network.OkHttpClientFactory',
  'import com.facebook.react.modules.network.OkHttpClientProvider',
];

const MARKER = '// corefit: request limit';

const SNIPPET = `    ${MARKER}
    OkHttpClientProvider.setOkHttpClientFactory(
      OkHttpClientFactory {
        val client = OkHttpClientProvider.createClientBuilder().build()
        client.dispatcher.maxRequestsPerHost = ${MAX_PER_HOST}
        client.dispatcher.maxRequests = ${MAX_TOTAL}
        client
      }
    )`;

/** Adds the imports and the factory to MainApplication.kt; running it twice changes nothing. */
function addRequestLimit(source) {
  if (source.includes(MARKER)) return source;
  if (!source.includes('super.onCreate()')) {
    throw new Error('with-okhttp-request-limit: MainApplication.onCreate() not found');
  }
  let out = source;
  for (const line of IMPORTS) {
    if (!out.includes(line))
      out = out.replace(/^(import android\.app\.Application)$/m, `$1\n${line}`);
  }
  return out.replace('super.onCreate()', `super.onCreate()\n${SNIPPET}`);
}

module.exports = (config) =>
  withMainApplication(config, (mod) => {
    mod.modResults.contents = addRequestLimit(mod.modResults.contents);
    return mod;
  });
module.exports.addRequestLimit = addRequestLimit;
