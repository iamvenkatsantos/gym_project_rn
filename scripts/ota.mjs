#!/usr/bin/env node
// Over-the-air updates for CoreFit Gym, served by our own server (infra/updates-server).
//
//   npm run ota -- publish  --channel develop -m "Fix check-in button"
//   npm run ota -- list     --channel develop
//   npm run ota -- rollback --channel develop                 # back to the previous update
//   npm run ota -- rollback --channel develop --to <id>       # back to a given update
//   npm run ota -- rollback --channel develop --embedded      # back to the code inside the build
//   npm run ota -- prune [--keep 5] [--yes]                   # delete old updates and unused files
//
// Options: --platform android|ios|all (default all), --server <url>, --force (skip git checks),
// --dry-run (publish: build and sign but upload nothing).
// Needs UPDATES_PUBLISH_TOKEN, and the signing key at keys/private-key.pem (or UPDATES_PRIVATE_KEY).
// Both can live in .env.ota.local (git-ignored).
//
// Channels match eas.json profiles: develop = preview builds, main = production builds. An update
// reaches only builds with the same channel and runtime version (app.json "version").

import { execFileSync } from 'node:child_process';
import { createHash, createSign, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const CHANNEL_PROFILES = { develop: 'preview', main: 'production' };
const KEY_ID = 'main';
const HISTORY_LENGTH = 20;

if (existsSync(join(ROOT, '.env.ota.local'))) process.loadEnvFile(join(ROOT, '.env.ota.local'));

const args = parseArgs(process.argv.slice(2));
const SERVER = (args.server ?? process.env.UPDATES_SERVER ?? 'https://updates.vinven.net').replace(
  /\/$/,
  '',
);

try {
  await main();
} catch (error) {
  console.error(`\n✖ ${error.message}`);
  process.exit(1);
}

async function main() {
  const command = args._[0];
  const channel = args.channel;
  if (command === 'prune') return prune();
  if (!['publish', 'list', 'rollback'].includes(command)) {
    throw new Error(
      'Usage: npm run ota -- <publish|list|rollback> --channel <develop|main>, or prune',
    );
  }
  if (!CHANNEL_PROFILES[channel]) throw new Error('--channel must be develop or main');
  const platforms =
    !args.platform || args.platform === 'all' ? ['android', 'ios'] : [args.platform];
  if (!platforms.every((p) => p === 'android' || p === 'ios')) {
    throw new Error('--platform must be android, ios or all');
  }

  const env = buildEnv(channel);
  if (command === 'publish') return publish(channel, platforms, env);
  if (command === 'list') return list(channel, platforms, env);
  return rollback(channel, platforms, env);
}

// ---------- publish ----------

async function publish(channel, platforms, env) {
  checkGit(channel);
  const privateKey = readPrivateKey();
  const token = args['dry-run'] ? null : publishToken();
  const message = args.m ?? args.message ?? lastCommitSubject();
  const commit = git(['rev-parse', '--short', 'HEAD']);

  const runtimeVersions = Object.fromEntries(platforms.map((p) => [p, runtimeVersion(p, env)]));
  console.log(`Channel ${channel}, runtime ${JSON.stringify(runtimeVersions)}`);

  console.log('Exporting the JS bundle…');
  const outDir = join(ROOT, 'dist-ota');
  removeDir(outDir);
  run(
    'npx',
    ['expo', 'export', ...platforms.flatMap((p) => ['--platform', p]), '--output-dir', outDir],
    env,
  );
  const metadata = JSON.parse(readFileSync(join(outDir, 'metadata.json'), 'utf8'));
  const expoClient = JSON.parse(
    run('npx', ['expo', 'config', '--type', 'public', '--json'], env, { quiet: true }),
  );

  const files = new Map(); // object name → absolute path
  const releases = [];
  for (const platform of platforms) {
    const fileMeta = metadata.fileMetadata[platform];
    const bundlePath = join(outDir, fileMeta.bundle);
    const launch = describeFile(bundlePath, extname(fileMeta.bundle).slice(1) || 'js');
    files.set(launch.objectName, bundlePath);
    const assets = fileMeta.assets.map((asset) => {
      const path = join(outDir, asset.path);
      const info = describeFile(path, asset.ext);
      files.set(info.objectName, path);
      return {
        hash: info.hash,
        key: info.key,
        contentType: contentType(asset.ext),
        fileExtension: `.${asset.ext}`,
        url: `/assets/${info.objectName.slice('assets/'.length)}`,
      };
    });
    const manifest = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      runtimeVersion: runtimeVersions[platform],
      launchAsset: {
        hash: launch.hash,
        key: launch.key,
        contentType: 'application/javascript',
        url: `/assets/${launch.objectName.slice('assets/'.length)}`,
      },
      assets,
      metadata: {},
      extra: { expoClient },
    };
    releases.push({ platform, manifest });
  }

  if (args['dry-run']) {
    for (const { platform, manifest } of releases) {
      console.log(`${platform}: update ${manifest.id}, ${manifest.assets.length} assets`);
    }
    console.log(`Dry run: ${files.size} files ready in dist-ota, nothing uploaded.`);
    return;
  }

  const uploaded = new Set((await api('GET', '/admin/assets', token)).assets);
  const missing = [...files.entries()].filter(
    ([name]) => !uploaded.has(name.slice('assets/'.length)),
  );
  console.log(
    `Uploading ${missing.length} new files (${files.size - missing.length} already there)…`,
  );
  await inBatches(missing, 6, ([name, path]) =>
    api('PUT', `/admin/objects/${name}`, token, readFileSync(path)),
  );

  for (const { platform, manifest } of releases) {
    await saveAndPoint({ channel, platform, manifest, privateKey, token, message, commit });
  }
  removeDir(outDir);
  console.log('\n✔ Published. Phones get it on their next launch and run it on the one after.');
}

// ---------- list ----------

async function list(channel, platforms, env) {
  const token = publishToken();
  for (const platform of platforms) {
    const rv = args['runtime-version'] ?? runtimeVersion(platform, env);
    const pointer = await getJson(`channels/${channel}/${rv}/${platform}.json`, token);
    console.log(`\n${platform} · ${channel} · runtime ${rv}`);
    if (!pointer) {
      console.log('  Nothing published yet: phones run the code inside their build.');
      continue;
    }
    pointer.history.forEach((entry, i) => {
      const what = entry.type === 'rollBackToEmbedded' ? 'build’s own code' : entry.updateId;
      const tag = i === 0 ? '→ live ' : '       ';
      console.log(
        `  ${tag}${entry.publishedAt}  ${what}  ${entry.commit ?? ''}  ${entry.message ?? ''}`,
      );
    });
  }
}

// ---------- rollback ----------

async function rollback(channel, platforms, env) {
  const privateKey = readPrivateKey();
  const token = publishToken();
  for (const platform of platforms) {
    const rv = args['runtime-version'] ?? runtimeVersion(platform, env);
    const pointer = await getJson(`channels/${channel}/${rv}/${platform}.json`, token);
    if (!pointer) throw new Error(`${platform}: nothing published on ${channel} for runtime ${rv}`);

    if (args.embedded) {
      const directive = JSON.stringify({
        type: 'rollBackToEmbedded',
        parameters: { commitTime: new Date().toISOString() },
      });
      const entry = {
        type: 'rollBackToEmbedded',
        publishedAt: new Date().toISOString(),
        message: 'Rolled back to the build’s own code',
      };
      await putJson(`channels/${channel}/${rv}/${platform}.json`, token, {
        ...entry,
        channel,
        platform,
        runtimeVersion: rv,
        directive,
        signature: sign(directive, privateKey),
        history: [entry, ...pointer.history].slice(0, HISTORY_LENGTH),
      });
      console.log(`✔ ${platform}: phones go back to the build’s own code on their next launch.`);
      continue;
    }

    // Phones only take an update newer than the one they run, so a rollback republishes the
    // older update under a new id and time. Its files are already on the server.
    const targetId =
      args.to ??
      pointer.history.find(
        (e, i) => i > 0 && e.type === 'update' && e.updateId !== pointer.updateId,
      )?.updateId;
    if (!targetId) throw new Error(`${platform}: no earlier update to go back to`);
    const record = await getJson(`updates/${rv}/${platform}/${targetId}.json`, token);
    if (!record) throw new Error(`${platform}: update ${targetId} not found for runtime ${rv}`);
    const manifest = {
      ...JSON.parse(record.manifest),
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    await saveAndPoint({
      channel,
      platform,
      manifest,
      privateKey,
      token,
      message: `Rollback to ${targetId}: ${record.message ?? ''}`.trim(),
      commit: record.commit,
    });
  }
}

// ---------- prune ----------

// Frees storage. Keeps, for every channel, runtime version and platform, the newest --keep
// updates in its history (default 5, so rollback still works), plus every file those updates use.
// Deletes all other update records and asset files. Shows what it would delete unless --yes.
// Don't run it while a publish is uploading: that publish's new files aren't referenced yet.
async function prune() {
  const token = publishToken();
  const keep = Number(args.keep ?? 5);
  if (!Number.isInteger(keep) || keep < 1) throw new Error('--keep must be 1 or more');

  const listKeys = async (folder) => {
    const res = await api('GET', `/admin/keys/${folder}`, token);
    if (!res) throw new Error('The server is too old for prune: redeploy infra/updates-server.');
    return res.keys;
  };
  const pointerKeys = await listKeys('channels');
  const updateKeys = await listKeys('updates');
  const assetKeys = await listKeys('assets');

  const keptIds = new Set();
  for (const key of pointerKeys) {
    const pointer = await getJson(key, token);
    if (!pointer) continue;
    if (pointer.type === 'update') keptIds.add(pointer.updateId);
    const updates = pointer.history.filter((e) => e.type === 'update').slice(0, keep);
    for (const entry of updates) keptIds.add(entry.updateId);
  }

  const idOf = (key) => key.slice(key.lastIndexOf('/') + 1).replace(/\.json$/, '');
  const keptUpdates = updateKeys.filter((key) => keptIds.has(idOf(key)));
  const oldUpdates = updateKeys.filter((key) => !keptIds.has(idOf(key)));

  const usedAssets = new Set();
  for (const key of keptUpdates) {
    const record = await getJson(key, token);
    const manifest = JSON.parse(record.manifest);
    for (const asset of [manifest.launchAsset, ...manifest.assets]) {
      usedAssets.add(`assets/${asset.url.slice(asset.url.lastIndexOf('/') + 1)}`);
    }
  }
  const unusedAssets = assetKeys.filter((key) => !usedAssets.has(key));

  console.log(`Keeping ${keptUpdates.length} updates and ${usedAssets.size} files.`);
  console.log(`Old: ${oldUpdates.length} updates and ${unusedAssets.length} unused files.`);
  if (!oldUpdates.length && !unusedAssets.length) return console.log('Nothing to delete.');
  if (!args.yes) return console.log('Run again with --yes to delete them.');

  // Records first, so a file is never gone while a kept update still points at it.
  await inBatches([...oldUpdates, ...unusedAssets], 6, (key) =>
    api('DELETE', `/admin/objects/${key}`, token),
  );
  console.log('✔ Deleted.');
}

// ---------- shared ----------

async function saveAndPoint({ channel, platform, manifest, privateKey, token, message, commit }) {
  const rv = manifest.runtimeVersion;
  const body = JSON.stringify(manifest);
  const signature = sign(body, privateKey);
  const publishedAt = new Date().toISOString();
  await putJson(`updates/${rv}/${platform}/${manifest.id}.json`, token, {
    manifest: body,
    signature,
    message,
    commit,
    createdAt: manifest.createdAt,
  });
  const pointerKey = `channels/${channel}/${rv}/${platform}.json`;
  const previous = await getJson(pointerKey, token);
  const entry = { type: 'update', updateId: manifest.id, publishedAt, message, commit };
  await putJson(pointerKey, token, {
    ...entry,
    channel,
    platform,
    runtimeVersion: rv,
    history: [entry, ...(previous?.history ?? [])].slice(0, HISTORY_LENGTH),
  });
  console.log(`✔ ${platform}: ${manifest.id} is live on ${channel} (runtime ${rv})`);
}

/** expo-updates signature header: RSA-SHA256 over the exact JSON text the server sends. */
function sign(body, privateKey) {
  const signer = createSign('RSA-SHA256');
  signer.update(body, 'utf8');
  return `sig="${signer.sign(privateKey, 'base64')}", keyid="${KEY_ID}"`;
}

function describeFile(path, ext) {
  const data = readFileSync(path);
  const key = createHash('md5').update(data).digest('hex');
  const hash = createHash('sha256').update(data).digest('base64url');
  return { key, hash, objectName: `assets/${key}${ext ? `.${ext}` : ''}` };
}

function contentType(ext) {
  const types = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    ttf: 'font/ttf',
    otf: 'font/otf',
    json: 'application/json',
    mp4: 'video/mp4',
  };
  return types[ext.toLowerCase()] ?? 'application/octet-stream';
}

/** The same env the build had (eas.json profile), so the bundle talks to the right backend. */
function buildEnv(channel) {
  const eas = JSON.parse(readFileSync(join(ROOT, 'eas.json'), 'utf8'));
  const profileEnv = eas.build?.[CHANNEL_PROFILES[channel]]?.env ?? {};
  return { ...process.env, ...profileEnv, APP_UPDATES_CHANNEL: channel, NODE_ENV: 'production' };
}

function runtimeVersion(platform, env) {
  const out = run('npx', ['expo-updates', 'runtimeversion:resolve', '--platform', platform], env, {
    quiet: true,
  });
  const { runtimeVersion: rv } = JSON.parse(out.slice(out.indexOf('{')));
  if (!rv) throw new Error(`Could not work out the runtime version for ${platform}`);
  return rv;
}

function checkGit(channel) {
  if (args.force) return;
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch !== channel) {
    throw new Error(
      `You're on "${branch}". Publish ${channel} from the ${channel} branch, or pass --force.`,
    );
  }
  if (git(['status', '--porcelain'])) {
    throw new Error('Uncommitted changes. Commit or stash them first, or pass --force.');
  }
}

function readPrivateKey() {
  const path = resolve(ROOT, process.env.UPDATES_PRIVATE_KEY ?? 'keys/private-key.pem');
  if (!existsSync(path)) {
    throw new Error(`Signing key not found at ${path}. Set UPDATES_PRIVATE_KEY.`);
  }
  return readFileSync(path, 'utf8');
}

function publishToken() {
  const token = process.env.UPDATES_PUBLISH_TOKEN;
  if (!token) throw new Error('Set UPDATES_PUBLISH_TOKEN (same value as the server secret).');
  return token;
}

async function api(method, path, token, body) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${SERVER}${path}`, {
        method,
        headers: { authorization: `Bearer ${token}` },
        body,
      });
      if (res.status === 404 && method === 'GET') return null;
      if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
      return method === 'GET' ? res.json() : res.text();
    } catch (error) {
      if (attempt >= 3 || /: (4\d\d) /.test(error.message)) throw error;
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
}

function getJson(key, token) {
  return api('GET', `/admin/objects/${key}`, token);
}

function putJson(key, token, value) {
  return api('PUT', `/admin/objects/${key}`, token, JSON.stringify(value));
}

async function inBatches(items, size, fn) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
    process.stdout.write(`\r  ${Math.min(i + size, items.length)}/${items.length}`);
  }
  if (items.length) process.stdout.write('\n');
}

function run(cmd, cmdArgs, env, { quiet = false } = {}) {
  return execFileSync(cmd, cmdArgs, {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    stdio: quiet ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'pipe', 'inherit'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** macOS (Spotlight, Finder) can hold files for a moment; retry, and never fail a publish over it. */
function removeDir(dir) {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    // Left behind: the next publish clears it, and git ignores dist-ota/.
  }
}

function git(gitArgs) {
  return execFileSync('git', gitArgs, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function lastCommitSubject() {
  return git(['log', '-1', '--pretty=%s']);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--') || a === '-m') {
      const name = a.replace(/^-+/, '');
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('-')) out[name] = true;
      else out[name] = argv[++i];
    } else out._.push(a);
  }
  return out;
}
