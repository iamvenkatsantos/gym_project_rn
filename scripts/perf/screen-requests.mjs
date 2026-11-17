#!/usr/bin/env node
// Static estimate of the requests each screen fires on open: follows a screen's imports
// (components included) and counts the query hooks it mounts, then the API calls behind each hook.
// Usage: node scripts/perf/screen-requests.mjs [--json out.json]
// An estimate only (conditional rendering and `enabled` flags are not evaluated); the real-phone
// numbers come from EXPO_PUBLIC_PERF_LOG. Read-only, no network.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const read = (f) => readFileSync(f, 'utf8');
function walk(d, out = []) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) {
      if (n !== '__tests__') walk(p, out);
    } else if (/\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}
const resolve = (from, spec) => {
  const base = spec.startsWith('@/')
    ? join(root, 'src', spec.slice(2))
    : spec.startsWith('.')
      ? join(dirname(from), spec)
      : null;
  if (!base) return null;
  return (
    [base + '.ts', base + '.tsx', join(base, 'index.ts'), join(base, 'index.tsx')].find(
      existsSync,
    ) ?? null
  );
};

// hook name -> { queryHook: bool, apiFns: [...] } from every hooks file
const hookInfo = new Map();
for (const f of walk(join(root, 'src')).filter((f) => /hooks\.ts$|use-[\w-]+\.tsx?$/.test(f))) {
  const src = read(f);
  for (const m of src.matchAll(/export function (use\w+)/g)) {
    const end = src.indexOf('\nexport ', m.index + 10);
    const body = src.slice(m.index, end === -1 ? undefined : end);
    const isQuery = /useQuery\(|useQueries\(|useInfiniteQuery\(/.test(body);
    const fns = [...body.matchAll(/queryFn:[^\n]*?\b(\w+)\(/g)].map((x) => x[1]);
    hookInfo.set(m[1], { isQuery, fns, file: relative(root, f) });
  }
}

function hooksOf(screen) {
  const seen = new Set();
  const hooks = new Map();
  (function visit(f) {
    if (seen.has(f)) return;
    seen.add(f);
    const src = read(f);
    for (const m of src.matchAll(/\b(use[A-Z]\w+)\(/g)) {
      const h = hookInfo.get(m[1]);
      if (h?.isQuery) hooks.set(m[1], (hooks.get(m[1]) ?? 0) + 1);
    }
    for (const m of src.matchAll(/from '([^']+)'/g)) {
      const t = resolve(f, m[1]);
      if (t && !/hooks\.ts$|api\.ts$|use-[\w-]+\.tsx?$|\/lib\//.test(t)) visit(t);
    }
  })(screen);
  return hooks;
}

const screens = walk(join(root, 'src/app')).filter((f) => !/_layout\.tsx$/.test(f));
const rows = screens
  .map((s) => {
    const hooks = hooksOf(s);
    return {
      screen: relative(join(root, 'src/app'), s).replace(/\.tsx$/, ''),
      queryHooks: hooks.size,
      hooks: [...hooks.keys()],
      // the same hook mounted twice on one screen shares one request while data is fresh
      mountedTwice: [...hooks].filter(([, n]) => n > 1).map(([h]) => h),
    };
  })
  .sort((a, b) => b.queryHooks - a.queryHooks);

if (process.argv.includes('--json'))
  writeFileSync(process.argv[process.argv.indexOf('--json') + 1], JSON.stringify(rows, null, 2));
else
  for (const r of rows.slice(0, 40))
    console.log(`${String(r.queryHooks).padStart(3)}  ${r.screen}`);
