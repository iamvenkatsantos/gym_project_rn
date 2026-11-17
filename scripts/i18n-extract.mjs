#!/usr/bin/env node
/**
 * Finds the English text the app shows and checks it against the translations.
 *
 *   node scripts/i18n-extract.mjs            # list text missing a translation
 *   node scripts/i18n-extract.mjs --strict   # same, failing when any is missing
 *   node scripts/i18n-extract.mjs --json     # print every key found, as JSON
 *
 * Text that must stay in English, or that the heuristic picks up but never shows, goes in
 * `scripts/i18n-ignore.json`.
 *
 * Keys are the English text itself. `{name}` marks a value filled in at run time, the
 * way `src/i18n/translate.ts` matches it. Heuristic: it reads JSX text, string props,
 * and capitalised strings and templates; it may list a few strings that are never shown.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const root = new URL('..', import.meta.url).pathname;
const srcDir = join(root, 'src');
// Stays in English for now: the platform admin's area (VinVen only), demo data, the PDF
// writer, and exercise content (names, how-to steps, stretches, smart plans).
const skipPaths = [
  /^src\/app\/admin/,
  /^src\/i18n\//,
  /__tests__/,
  /mock(-db)?\.ts$/,
  /\.test\.tsx?$/,
  /^src\/lib\/image-pdf\.ts$/,
  /^src\/features\/exercises\/library\.ts$/,
  /^src\/features\/workouts\/(smart-plans|stretches|stretch-demos)\.ts$/,
];
const skipAttrs = new Set([
  'style',
  'testID',
  'href',
  'name',
  'icon',
  'key',
  'nativeID',
  'keyboardType',
  'autoComplete',
  'textContentType',
  'autoCapitalize',
  'returnKeyType',
  'inputMode',
  'type',
  'variant',
  'size',
  'themeColor',
  'tone',
  'color',
  'accessibilityRole',
  'resizeMode',
  'contentFit',
  'pointerEvents',
  'behavior',
  'presentation',
  'source',
  'uri',
  'url',
  'route',
  'pathname',
  'mode',
  'value',
]);
const skipCalls = new Set([
  'rpc',
  'from',
  'select',
  'eq',
  'neq',
  'in',
  'order',
  'invoke',
  'push',
  'replace',
  'navigate',
  'setItem',
  'getItem',
  'removeItem',
  'require',
  'useQuery',
  'invalidateQueries',
  'toLocaleDateString',
  'toLocaleTimeString',
  'toLocaleString',
  'padStart',
  'split',
  'join',
  'startsWith',
  'endsWith',
  'includes',
  'match',
  'test',
  'upload',
  'getPublicUrl',
  'createSignedUrl',
  'storage',
  'channel',
  'on',
  'filter',
  'or',
  'is',
  'gte',
  'lte',
  'lt',
  'gt',
  'ilike',
  'like',
  'contains',
  'openURL',
  'canOpenURL',
  'log',
  'warn',
  'error',
  'info',
  'debug',
  'Error',
  'create',
  'defineTask',
  'setNotificationChannelAsync',
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(path);
  }
  return out;
}

const entities = { apos: "'", quot: '"', amp: '&', lt: '<', gt: '>', nbsp: ' ' };
const decode = (s) => s.replace(/&(apos|quot|amp|lt|gt|nbsp);/g, (_, e) => entities[e]);
const norm = (s) => decode(s).replace(/\s+/g, ' ').trim();

/** Looks like words a person reads, not an id, path or code. */
function looksLikeCopy(s) {
  if (!s || s.length < 2) return false;
  if (!/[A-Za-z]{2}/.test(s)) return false;
  if (/^[a-z0-9_.:/-]+$/.test(s)) return false; // ids, keys, paths
  if (/^(https?:|corefit:|mailto:|tel:|#|\.|\/)/.test(s)) return false;
  if (/[a-z][A-Z]/.test(s) && !/\s/.test(s)) return false; // camelCase
  if (/^[A-Z0-9_]+$/.test(s) && s.length > 3) return false; // CONSTANTS
  if (/\$\{|=>|;$|\bselect\b.*,/.test(s)) return false;
  if (/^[\w-]+(,[\w-]+)+$/.test(s)) return false; // column lists
  if (/!\w+\(|\w+\(\*\)|\w+:\w+\(/.test(s)) return false; // PostgREST embeds
  if (/^[A-Z]/.test(s) || /\s/.test(s) || /[?!…]$/.test(s)) return true;
  return false;
}

function placeholderName(expr, used) {
  let base = 'x';
  let e = expr;
  while (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isAsExpression(e)) {
    e = e.expression;
  }
  if (ts.isIdentifier(e)) base = e.text;
  else if (ts.isPropertyAccessExpression(e)) base = e.name.text;
  else if (ts.isCallExpression(e)) {
    const c = e.expression;
    base = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : 'x';
  }
  base = base.replace(/[^A-Za-z0-9]/g, '') || 'x';
  let name = base;
  let i = 2;
  while (used.has(name)) name = `${base}${i++}`;
  used.add(name);
  return name;
}

const found = new Map(); // key -> Set(file)
function add(key, file) {
  key = norm(key);
  if (!looksLikeCopy(key.replace(/\{\w+\}/g, ''))) return;
  if (!/[A-Za-z]{2}/.test(key.replace(/\{\w+\}/g, ''))) return;
  if (!found.has(key)) found.set(key, new Set());
  found.get(key).add(file);
}

function calleeName(call) {
  const c = call.expression;
  if (ts.isIdentifier(c)) return c.text;
  if (ts.isPropertyAccessExpression(c)) return c.name.text;
  return '';
}

function isSkippedContext(node) {
  let p = node.parent;
  if (!p) return true;
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p))
    return true;
  if (ts.isLiteralTypeNode(p)) return true;
  if (ts.isPropertyAssignment(p) && p.name === node) return true;
  if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) {
    const k = p.name.text;
    if (
      /^(key|queryKey|name|icon|href|pathname|route|id|value|kind|type|channel|method|tone|variant|status|role|color|storage|bucket|format|mode)$/.test(
        k,
      )
    )
      return true;
  }
  if (ts.isElementAccessExpression(p)) return true;
  if (ts.isCaseClause(p)) return true;
  if (ts.isBinaryExpression(p) && /^(===|!==|==|!=)$/.test(p.operatorToken.getText())) return true;
  if (ts.isJsxAttribute(p)) return skipAttrs.has(p.name.getText());
  if (ts.isJsxExpression(p) && p.parent && ts.isJsxAttribute(p.parent))
    return skipAttrs.has(p.parent.name.getText());
  // Walk up through ?: and || to the call or attribute that uses it.
  while (
    p &&
    (ts.isConditionalExpression(p) ||
      ts.isBinaryExpression(p) ||
      ts.isParenthesizedExpression(p) ||
      ts.isArrayLiteralExpression(p))
  ) {
    p = p.parent;
  }
  if (p && ts.isCallExpression(p) && skipCalls.has(calleeName(p))) return true;
  if (p && ts.isNewExpression(p) && ts.isIdentifier(p.expression) && p.expression.text !== 'Error')
    return true;
  if (p && ts.isJsxExpression(p) && p.parent && ts.isJsxAttribute(p.parent))
    return skipAttrs.has(p.parent.name.getText());
  return false;
}

/** JSX's own whitespace rule: lines are trimmed and joined by one space; blank lines go. */
function jsxText(raw) {
  const lines = raw.split(/\r\n|\n|\r/);
  const out = [];
  lines.forEach((line, i) => {
    if (i > 0) line = line.replace(/^[ \t]+/, '');
    if (i < lines.length - 1) line = line.replace(/[ \t]+$/, '');
    if (line) out.push(line);
  });
  return decode(out.join(' '));
}

function visitJsxChildren(el, file) {
  const kids = el.children;
  const hasText = kids.some((k) => ts.isJsxText(k) && norm(k.text));
  const hasExpr = kids.some((k) => ts.isJsxExpression(k) && k.expression);
  const hasElement = kids.some((k) => ts.isJsxElement(k) || ts.isJsxSelfClosingElement(k));
  if (hasText && hasExpr && !hasElement) {
    const used = new Set();
    let key = '';
    for (const k of kids) {
      if (ts.isJsxText(k)) key += jsxText(k.text);
      else if (ts.isJsxExpression(k) && k.expression) {
        const e = k.expression;
        if (ts.isStringLiteral(e)) key += e.text;
        else key += `{${placeholderName(e, used)}}`;
      }
    }
    add(key, file);
  } else {
    for (const k of kids) if (ts.isJsxText(k) && norm(k.text)) add(k.text, file);
  }
}

function templateKey(node) {
  const used = new Set();
  let key = node.head.text;
  for (const span of node.templateSpans) {
    key += `{${placeholderName(span.expression, used)}}` + span.literal.text;
  }
  return key;
}

export function extract() {
  for (const path of walk(srcDir)) {
    const rel = relative(root, path);
    if (skipPaths.some((r) => r.test(rel))) continue;
    const text = readFileSync(path, 'utf8');
    const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node) => {
      if (ts.isJsxElement(node)) visitJsxChildren(node, rel);
      else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        if (!isSkippedContext(node)) add(node.text, rel);
      } else if (ts.isTemplateExpression(node)) {
        if (!isSkippedContext(node)) add(templateKey(node), rel);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return found;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  const keys = extract();
  if (process.argv.includes('--json')) {
    const out = {};
    for (const [k, files] of [...keys].sort((a, b) => a[0].localeCompare(b[0])))
      out[k] = [...files].join(', ');
    console.log(JSON.stringify(out, null, 1));
  } else {
    // Every key in src/i18n/strings/part*.ts, with how many translations it has.
    const have = new Map();
    const dir = join(root, 'src/i18n/strings');
    for (const name of readdirSync(dir).filter((n) => /^part\d+\.ts$/.test(n))) {
      const sf = ts.createSourceFile(name, readFileSync(join(dir, name), 'utf8'), 99, true);
      const v = (n) => {
        if (ts.isPropertyAssignment(n) && (ts.isStringLiteral(n.name) || ts.isIdentifier(n.name))) {
          const filled = ts.isArrayLiteralExpression(n.initializer)
            ? n.initializer.elements.filter((e) => ts.isStringLiteral(e) && e.text).length
            : 0;
          have.set(n.name.text, filled);
        }
        ts.forEachChild(n, v);
      };
      v(sf);
    }
    const ignored = new Set(
      JSON.parse(readFileSync(join(root, 'scripts/i18n-ignore.json'), 'utf8')),
    );
    const columns = 2; // Tamil, Hindi: the languages with a column in languages.ts
    const gaps = [...keys.keys()].filter((k) => !ignored.has(k) && (have.get(k) ?? 0) < columns);
    const wanted = [...keys.keys()].filter((k) => !ignored.has(k)).length;
    console.log(`${wanted - gaps.length}/${wanted} translated (${ignored.size} ignored)`);
    for (const g of gaps) console.log(`  ${JSON.stringify(g)}  (${[...keys.get(g)][0]})`);
    const missing = gaps.length;
    process.exitCode = missing && process.argv.includes('--strict') ? 1 : 0;
  }
}
