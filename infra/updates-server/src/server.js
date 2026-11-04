// CoreFit Gym update server: the Expo Updates protocol (v1) over a plain key/value store.
//
// Runs unchanged on Cloudflare Workers (worker.js, R2) and on Node (node.js, a folder on disk),
// because it only uses web-standard Request/Response. The publish script (scripts/ota.mjs) does
// all the work: it builds and signs each manifest on Venkat's machine, so this server holds no
// signing key and never changes a manifest. It only picks the right one and streams files.
//
// Store layout (same keys in R2 and on disk):
//   assets/<md5><.ext>                          bundle and assets, content-addressed, never change
//   updates/<runtime>/<platform>/<id>.json      { manifest, signature, message, commit, createdAt }
//   channels/<channel>/<runtime>/<platform>.json  what that channel serves now, plus history
//
// Routes:
//   GET  /manifest                 the app asks for its update (expo-* headers)
//   GET  /assets/<name>            bundle and asset files
//   GET  /admin/objects/<key>      publish script reads (Bearer token)
//   PUT  /admin/objects/<key>      publish script writes (Bearer token)
//   GET  /admin/assets             publish script lists uploaded assets (Bearer token)
//   GET  /admin/keys/<folder>      prune lists assets, updates or channels (Bearer token)
//   DELETE /admin/objects/<key>    prune removes what no channel needs (Bearer token)

const PLATFORMS = new Set(['android', 'ios']);
const SAFE_PART = /^[A-Za-z0-9._-]{1,64}$/;
const ASSET_NAME = /^[A-Za-z0-9]{1,128}(\.[A-Za-z0-9]{1,16})?$/;
const OBJECT_KEY =
  /^(assets\/[A-Za-z0-9]{1,128}(\.[A-Za-z0-9]{1,16})?|(updates|channels)\/[A-Za-z0-9._-]{1,64}\/[A-Za-z0-9._-]{1,64}\/[A-Za-z0-9._-]{1,64}\.json)$/;

const CONTENT_TYPES = {
  hbc: 'application/javascript',
  js: 'application/javascript',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ttf: 'font/ttf',
  otf: 'font/otf',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
};

/**
 * @typedef {{
 *   get(key: string): Promise<{ body: ReadableStream | Uint8Array | string, size?: number } | null>,
 *   put(key: string, body: ArrayBuffer): Promise<void>,
 *   list(prefix: string): Promise<string[]>,
 *   delete(key: string): Promise<void>,
 * }} Store
 */

/**
 * @param {Request} request
 * @param {Store} store
 * @param {{ publishToken?: string }} options
 * @returns {Promise<Response>}
 */
export async function handleRequest(request, store, options = {}) {
  const url = new URL(request.url);
  const path = url.pathname;
  try {
    if (path === '/' || path === '/health') {
      return text(200, 'ok');
    }
    if (path === '/manifest' && (request.method === 'GET' || request.method === 'HEAD')) {
      return await serveManifest(request, url, store);
    }
    if (path.startsWith('/assets/') && (request.method === 'GET' || request.method === 'HEAD')) {
      return await serveAsset(path.slice('/assets/'.length), store, request.method === 'HEAD');
    }
    if (path.startsWith('/admin/')) {
      if (!authorised(request, options.publishToken)) return text(401, 'Unauthorised');
      return await serveAdmin(request, path.slice('/admin/'.length), store);
    }
    return text(404, 'Not found');
  } catch (error) {
    console.error(error);
    return text(500, 'Server error');
  }
}

/** What a channel serves now, for one runtime version and platform. */
export function channelKey(channel, runtimeVersion, platform) {
  return `channels/${channel}/${runtimeVersion}/${platform}.json`;
}

export function updateKey(runtimeVersion, platform, id) {
  return `updates/${runtimeVersion}/${platform}/${id}.json`;
}

async function serveManifest(request, url, store) {
  const h = request.headers;
  // Query params are only a fallback for testing with curl; the app sends headers.
  const platform = h.get('expo-platform') ?? url.searchParams.get('platform');
  const runtimeVersion = h.get('expo-runtime-version') ?? url.searchParams.get('runtime-version');
  const channel = h.get('expo-channel-name') ?? url.searchParams.get('channel');

  if (!platform || !PLATFORMS.has(platform)) return text(400, 'Unknown expo-platform');
  if (!runtimeVersion || !SAFE_PART.test(runtimeVersion)) {
    return text(400, 'Missing expo-runtime-version');
  }
  if (!channel || !SAFE_PART.test(channel)) return text(400, 'Missing expo-channel-name');

  const pointer = await readJson(store, channelKey(channel, runtimeVersion, platform));
  if (!pointer) return noUpdate();

  const currentId = h.get('expo-current-update-id');
  const embeddedId = h.get('expo-embedded-update-id');

  if (pointer.type === 'rollBackToEmbedded') {
    // Already running the build's own bundle: nothing to do.
    if (currentId && embeddedId && currentId === embeddedId) return noUpdate();
    return multipart('directive', pointer.directive, pointer.signature);
  }

  if (currentId && currentId === pointer.updateId) return noUpdate();
  const record = await readJson(store, updateKey(runtimeVersion, platform, pointer.updateId));
  if (!record) return noUpdate();
  return multipart('manifest', record.manifest, record.signature);
}

async function serveAsset(name, store, headOnly) {
  if (!ASSET_NAME.test(name)) return text(404, 'Not found');
  const object = await store.get(`assets/${name}`);
  if (!object) return text(404, 'Not found');
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
  const headers = {
    'content-type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
    // Names are content hashes, so a file never changes.
    'cache-control': 'public, max-age=31536000, immutable',
  };
  if (object.size !== undefined) headers['content-length'] = String(object.size);
  return new Response(headOnly ? null : object.body, { status: 200, headers });
}

async function serveAdmin(request, rest, store) {
  if (rest === 'assets' && request.method === 'GET') {
    const keys = await store.list('assets/');
    return json(200, { assets: keys.map((k) => k.slice('assets/'.length)) });
  }
  // Every key under assets/, updates/ or channels/, for `npm run ota -- prune`.
  if (rest.startsWith('keys/') && request.method === 'GET') {
    const prefix = rest.slice('keys/'.length);
    if (!['assets', 'updates', 'channels'].includes(prefix)) return text(400, 'Bad prefix');
    return json(200, { keys: await store.list(`${prefix}/`) });
  }
  if (rest.startsWith('objects/')) {
    const key = rest.slice('objects/'.length);
    if (!OBJECT_KEY.test(key)) return text(400, 'Bad key');
    if (request.method === 'GET') {
      const object = await store.get(key);
      if (!object) return text(404, 'Not found');
      return new Response(object.body, { status: 200 });
    }
    if (request.method === 'PUT') {
      await store.put(key, await request.arrayBuffer());
      return text(200, 'saved');
    }
    if (request.method === 'DELETE') {
      await store.delete(key);
      return text(200, 'deleted');
    }
  }
  return text(404, 'Not found');
}

function authorised(request, token) {
  if (!token) return false;
  const given = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${token}`;
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

async function readJson(store, key) {
  const object = await store.get(key);
  if (!object) return null;
  const body = object.body;
  const raw =
    typeof body === 'string'
      ? body
      : body instanceof Uint8Array
        ? new TextDecoder().decode(body)
        : await new Response(body).text();
  return JSON.parse(raw);
}

const PROTOCOL_HEADERS = {
  'expo-protocol-version': '1',
  'expo-sfv-version': '0',
  'cache-control': 'private, max-age=0',
};

/** Protocol v1: an empty 204 means "keep what you have". */
function noUpdate() {
  return new Response(null, { status: 204, headers: PROTOCOL_HEADERS });
}

/** One signed part (the manifest or a directive), in the multipart body the protocol expects. */
export function multipart(name, body, signature) {
  const boundary = `corefit-${crypto.randomUUID()}`;
  const partHeaders = [
    'content-type: application/json; charset=utf-8',
    `content-disposition: form-data; name="${name}"`,
  ];
  if (signature) partHeaders.push(`expo-signature: ${signature}`);
  const payload = `--${boundary}\r\n${partHeaders.join('\r\n')}\r\n\r\n${body}\r\n--${boundary}--\r\n`;
  return new Response(payload, {
    status: 200,
    headers: { ...PROTOCOL_HEADERS, 'content-type': `multipart/mixed; boundary=${boundary}` },
  });
}

function text(status, message) {
  return new Response(message, { status, headers: { 'content-type': 'text/plain' } });
}

function json(status, value) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
