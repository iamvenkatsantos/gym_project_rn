// Cloudflare Worker entry for updates.vinven.net. Storage is the R2 bucket bound as UPDATES
// (wrangler.jsonc); the publish token is the Worker secret PUBLISH_TOKEN.
import { handleRequest } from './server.js';

export default {
  async fetch(request, env) {
    return handleRequest(request, r2Store(env.UPDATES), { publishToken: env.PUBLISH_TOKEN });
  },
};

function r2Store(bucket) {
  return {
    async get(key) {
      const object = await bucket.get(key);
      return object ? { body: object.body, size: object.size } : null;
    },
    async put(key, body) {
      await bucket.put(key, body);
    },
    async list(prefix) {
      const keys = [];
      let cursor;
      do {
        const page = await bucket.list({ prefix, cursor });
        for (const object of page.objects) keys.push(object.key);
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
      return keys;
    },
  };
}
