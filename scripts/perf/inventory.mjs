#!/usr/bin/env node
// Static inventory of every backend call in the app and web dashboard.
// Usage: node scripts/perf/inventory.mjs [--json out.json]
// Finds supabase .rpc()/.from()/functions.invoke() calls in src/ and web/src/, the exported api
// function that holds each one, and the hooks that call that function. Read-only; no network.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const SRC = [join(root, 'src'), join(root, 'web/src')];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const files = SRC.flatMap((d) => walk(d));
const text = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));

// 1. calls inside exported functions
const calls = [];
const fnRe = /export\s+(?:async\s+)?function\s+(\w+)/g;
for (const [file, src] of text) {
  if (file.endsWith('mock-db.ts')) continue;
  const starts = [...src.matchAll(fnRe)].map((m) => ({ name: m[1], at: m.index }));
  const callRe =
    /\.rpc\(\s*'(\w+)'|(?<!Array)(?<!storage)\.from\(\s*'(\w+)'|functions\.invoke(?:<[^(]*?>)?\(\s*'([\w-]+)'/g;
  for (const m of src.matchAll(callRe)) {
    const owner = [...starts].reverse().find((s) => s.at < m.index);
    const kind = m[1] ? 'rpc' : m[2] ? 'table' : 'edge';
    const target = m[1] ?? m[2] ?? m[3];
    // A write is a table call followed (in the same statement) by insert/update/upsert/delete.
    const tail = src.slice(m.index, m.index + 400);
    const write =
      kind === 'table'
        ? /\.(insert|update|upsert|delete)\(/.test(tail.split(';')[0])
        : kind === 'edge';
    calls.push({
      kind,
      target,
      fn: owner?.name ?? '(module)',
      file: relative(root, file),
      line: src.slice(0, m.index).split('\n').length,
      write,
    });
  }
}

// 2. hooks that call each api function
const hookUse = new Map();
for (const [file, src] of text) {
  if (!/hooks\.ts$|use-[\w-]+\.tsx?$/.test(file)) continue;
  for (const c of calls) {
    if (new RegExp(`\\b${c.fn}\\b`).test(src)) {
      const key = c.fn;
      const rel = relative(root, file);
      hookUse.set(key, [...new Set([...(hookUse.get(key) ?? []), rel])]);
    }
  }
}

// 3. screens that use those hooks
const screens = files.filter((f) => /\/src\/app\/|web\/src\/pages\//.test(f));
const rows = calls.map((c) => {
  const hooks = hookUse.get(c.fn) ?? [];
  const hookNames = new Set();
  for (const h of hooks) {
    for (const m of text.get(join(root, h)).matchAll(/export function (use\w+)/g)) {
      const body = text.get(join(root, h));
      const idx = body.indexOf(m[0]);
      const end = body.indexOf('\nexport ', idx + 10);
      if (new RegExp(`\\b${c.fn}\\b`).test(body.slice(idx, end === -1 ? undefined : end)))
        hookNames.add(m[1]);
    }
  }
  const usedBy = screens
    .filter((s) => [...hookNames].some((h) => new RegExp(`\\b${h}\\b`).test(text.get(s))))
    .map((s) =>
      relative(root, s)
        .replace(/^src\/app\//, '')
        .replace(/^web\/src\/pages\//, 'web:'),
    );
  return { ...c, hooks: [...hookNames], screens: usedBy };
});

if (process.argv.includes('--json')) {
  writeFileSync(process.argv[process.argv.indexOf('--json') + 1], JSON.stringify(rows, null, 2));
} else {
  console.log(
    `${rows.length} calls; ${new Set(rows.map((r) => r.kind + ':' + r.target)).size} distinct APIs`,
  );
  for (const r of rows)
    console.log(`${r.kind}\t${r.write ? 'W' : 'R'}\t${r.target}\t${r.fn}\t${r.hooks.join(',')}`);
}
