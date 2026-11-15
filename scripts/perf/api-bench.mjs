#!/usr/bin/env node
// CoreFit API benchmark. Read-only against production, any call against develop.
//
//   node scripts/perf/api-bench.mjs --env develop [--runs 20] [--out docs/perf/raw]
//   node scripts/perf/api-bench.mjs --env production --confirm-off-peak
//   node scripts/perf/api-bench.mjs --env production --dry-run     (prints the plan, no network)
//
// Credentials come from environment variables only (never committed, never printed):
//   PERF_API_URL      https://api.vinven.net for production (the app's own path), the develop URL otherwise
//   PERF_ANON_KEY     the public anon key for that project (never the service role key)
//   PERF_<ROLE>_EMAIL / PERF_<ROLE>_PASSWORD   for ROLE in OWNER SUPERVISOR TRAINER MEMBER ADMIN
// Test accounts must live in a separate gym named "CoreFit Perf Test": on production the script
// checks, after sign-in, that the account's gym has exactly that name and aborts otherwise.
// The platform admin role reads every gym, so production skips it unless --allow-admin.
//
// Production rules enforced here: GET table reads and an allow-list of read-only RPCs only,
// one request at a time, >= 200 ms between calls, 20 runs per API, only 23:00-05:00 IST, abort on
// any error or p95 over 5 s. Output holds API names and timings only, no ids, emails or tokens.
// Edge functions have side effects, so they are measured on develop only (--edge).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { READ_RPCS, buildCalls } from './manifest.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);

const env = opt('env', 'develop');
if (!['develop', 'production'].includes(env)) fail('--env must be develop or production');
const prod = env === 'production';
const runs = prod ? 20 : Number(opt('runs', 20));
const warmups = 2;
const gapMs = prod ? Math.max(200, Number(opt('gap', 250))) : Number(opt('gap', 50));
const p95Limit = 5000;
const roles = opt(
  'roles',
  prod ? 'owner,supervisor,trainer,member' : 'owner,supervisor,trainer,member,admin',
).split(',');
if (prod && roles.includes('admin') && !flag('allow-admin'))
  fail('the admin role reads every gym; production needs --allow-admin to include it');
const outDir = opt('out', 'docs/perf/raw');

function fail(msg) {
  console.error(`api-bench: ${msg}`);
  process.exit(1);
}

const istHour = (d = new Date()) =>
  (d.getUTCHours() + 5 + (d.getUTCMinutes() + 30 >= 60 ? 1 : 0)) % 24;
const offPeak = (h) => h >= 23 || h < 5;

if (prod) {
  if (flag('edge')) fail('edge functions have side effects: develop only');
  if (!flag('dry-run')) {
    if (!flag('confirm-off-peak')) fail('production needs --confirm-off-peak');
    if (!offPeak(istHour())) fail('production runs only 23:00-05:00 IST');
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (sorted, p) =>
  sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

if (flag('dry-run')) {
  console.log(`env=${env} runs=${runs} warmups=${warmups} gap=${gapMs}ms roles=${roles.join(',')}`);
  console.log(`read-only RPC allow-list (${READ_RPCS.size}): ${[...READ_RPCS].sort().join(', ')}`);
  process.exit(0);
}

const base = process.env.PERF_API_URL;
const anon = process.env.PERF_ANON_KEY;
if (!base || !anon) fail('set PERF_API_URL and PERF_ANON_KEY');
if (prod && !/^https:\/\/api\.vinven\.net\/?$/.test(base))
  fail('production must go through https://api.vinven.net, like the app');

let lastCall = 0;
async function http(method, path, { token, body } = {}) {
  const wait = gapMs - (Date.now() - lastCall);
  if (wait > 0) await sleep(wait);
  const started = performance.now();
  const res = await fetch(base.replace(/\/$/, '') + path, {
    method,
    headers: {
      apikey: anon,
      authorization: `Bearer ${token ?? anon}`,
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const ms = performance.now() - started;
  lastCall = Date.now();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return {
    status: res.status,
    ms,
    bytes: Buffer.byteLength(text),
    json,
    serverTiming: res.headers.get('server-timing'),
  };
}

// The only calls production may make. Anything else throws before it leaves the machine.
function guard(call) {
  if (!prod) return;
  if (
    call.method === 'GET' &&
    call.path.startsWith('/rest/v1/') &&
    !call.path.startsWith('/rest/v1/rpc/')
  )
    return;
  const m = call.path.match(/^\/rest\/v1\/rpc\/(\w+)$/);
  if (call.method === 'POST' && m && READ_RPCS.has(m[1])) return;
  throw new Error(`blocked in production: ${call.method} ${call.path.split('?')[0]}`);
}

async function signIn(role) {
  const email = process.env[`PERF_${role.toUpperCase()}_EMAIL`];
  const password = process.env[`PERF_${role.toUpperCase()}_PASSWORD`];
  if (!email || !password) return null;
  const r = await http('POST', '/auth/v1/token?grant_type=password', { body: { email, password } });
  if (r.status !== 200) fail(`${role}: sign-in failed (HTTP ${r.status})`);
  const session = { token: r.json.access_token, userId: r.json.user.id };
  if (prod && role !== 'admin') {
    // Every gym this account belongs to must be the perf gym, or nothing real is read.
    const g = await http(
      'GET',
      `/rest/v1/gym_members?select=gym:gyms(name)&user_id=eq.${session.userId}`,
      { token: session.token },
    );
    const names = Array.isArray(g.json) ? g.json.map((x) => x.gym?.name) : [];
    if (names.length === 0 || names.some((n) => n !== PERF_GYM))
      fail(
        `${role}: this account is not only in the "${PERF_GYM}" gym, refusing to run on production`,
      );
  }
  return session;
}

function rowCount(json) {
  if (Array.isArray(json)) return json.length;
  return json == null ? 0 : 1;
}

const PERF_GYM = 'CoreFit Perf Test';
const results = [];
const started = new Date();

for (const role of roles) {
  const session = await signIn(role);
  if (!session) {
    console.log(`skip ${role}: no credentials`);
    continue;
  }
  const ctx = {
    role,
    userId: session.userId,
    call: (m, p, b) => http(m, p, { token: session.token, body: b }),
  };
  const calls = await buildCalls(ctx);
  for (const call of calls) {
    try {
      guard(call);
    } catch (e) {
      fail(e.message);
    }
    const times = [];
    let last = null;
    for (let i = 0; i < warmups + runs; i++) {
      const r = await http(call.method, call.path, { token: session.token, body: call.body });
      if (prod && r.status >= 400) fail(`${role} ${call.name}: HTTP ${r.status}, aborting`);
      if (i >= warmups) times.push(r.ms);
      last = r;
    }
    times.sort((a, b) => a - b);
    const row = {
      api: call.name,
      type: call.type,
      role,
      rw: 'R',
      env,
      p50: Math.round(pct(times, 50)),
      p95: Math.round(pct(times, 95)),
      max: Math.round(times.at(-1)),
      status: last.status,
      sizeKb: +(last.bytes / 1024).toFixed(2),
      rows: rowCount(last.json),
    };
    results.push(row);
    console.log(
      `${role.padEnd(10)} ${call.name.padEnd(34)} p50 ${row.p50}  p95 ${row.p95}  ${row.sizeKb}KB  ${row.rows} rows`,
    );
    if (prod && row.p95 > p95Limit) fail(`${call.name}: p95 ${row.p95} ms is over 5 s, aborting`);
  }
}

// Edge functions: develop only. Wall time of a call that the function rejects at validation
// (no side effect) plus Server-Timing when the function sends it.
if (flag('edge') && !prod) {
  const { EDGE_PROBES } = await import('./manifest.mjs');
  for (const probe of EDGE_PROBES) {
    const times = [];
    let last = null;
    for (let i = 0; i < warmups + runs; i++) {
      last = await http('POST', `/functions/v1/${probe.name}`, { body: probe.body });
      if (i >= warmups) times.push(last.ms);
    }
    times.sort((a, b) => a - b);
    results.push({
      api: probe.name,
      type: 'edge',
      role: 'anon',
      rw: 'W',
      env,
      p50: Math.round(pct(times, 50)),
      p95: Math.round(pct(times, 95)),
      max: Math.round(times.at(-1)),
      status: last.status,
      sizeKb: +(last.bytes / 1024).toFixed(2),
      rows: 0,
      serverTiming: last.serverTiming ?? null,
      note: 'validation-path only; real work needs a seeded develop run',
    });
  }
}

mkdirSync(outDir, { recursive: true });
const file = join(outDir, `bench-${env}-${started.toISOString().slice(0, 10)}.json`);
writeFileSync(
  file,
  JSON.stringify({ env, startedAt: started.toISOString(), runs, warmups, gapMs, results }, null, 2),
);
console.log(`\n${results.length} rows -> ${file}`);
