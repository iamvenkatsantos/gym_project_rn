/**
 * Looks English text up in the translation table. Pure, so it works in tests and anywhere.
 *
 * A key is the English text. `{name}` in a key stands for a value filled in at run time, so
 * the key "{count} members" also translates "12 members"; the translation puts the value where
 * it says `{count}`. A value that is itself a key (like "Active", or " until {date}") is
 * translated too, one level deep.
 */
export type Table = Record<string, readonly string[]>;

type Pattern = {
  regex: RegExp;
  names: string[];
  key: string;
  /** Letters outside the placeholders: the more, the better the match. */
  weight: number;
  /** Characters outside the placeholders, to break ties. */
  literal: number;
  /** Starts and ends with a placeholder, like "{a} and {b}": only for short text. */
  open: boolean;
};

/**
 * Open-ended keys like "{a} until {b}" could also match a sentence someone typed, such as an
 * announcement, so they apply only to short text and need a few letters of their own.
 */
const OPEN_MAX_LENGTH = 48;
const OPEN_MIN_WEIGHT = 4;

const PLACEHOLDER = /\{(\w+)\}/g;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const patternCache = new WeakMap<Table, Pattern[]>();

function patternsOf(table: Table): Pattern[] {
  let list = patternCache.get(table);
  if (list) return list;
  list = [];
  for (const key of Object.keys(table)) {
    if (!key.includes('{')) continue;
    const names: string[] = [];
    let source = '^';
    let last = 0;
    for (const m of key.matchAll(PLACEHOLDER)) {
      source += escape(key.slice(last, m.index)) + '([\\s\\S]*?)';
      names.push(m[1]);
      last = m.index! + m[0].length;
    }
    source += escape(key.slice(last)) + '$';
    const weight = key.replace(PLACEHOLDER, '').replace(/[^\p{L}]/gu, '').length;
    const open = /^\{\w+\}/.test(key) && /\{\w+\}$/.test(key);
    // A key that is nearly all placeholders would match anything.
    if (weight < 2 || (open && weight < OPEN_MIN_WEIGHT)) continue;
    const literal = key.replace(PLACEHOLDER, '').length;
    list.push({ regex: new RegExp(source), names, key, weight, literal, open });
  }
  list.sort((a, b) => b.weight - a.weight || b.literal - a.literal);
  patternCache.set(table, list);
  return list;
}

/** Puts values into a translation's `{name}` slots. Unknown slots are left out. */
export function fill(text: string, values: Record<string, string | number | null | undefined>) {
  return text.replace(PLACEHOLDER, (_, name: string) => {
    const v = values[name];
    return v === null || v === undefined ? '' : String(v);
  });
}

const MAX_CACHE = 3000;

/**
 * Translates one piece of text, or returns it unchanged. Leading and trailing spaces are kept,
 * so pieces of a sentence split around a bold word still join up.
 */
export function createTranslator(table: Table, column: number) {
  const cache = new Map<string, string>();

  const exact = (text: string) => table[text]?.[column] || undefined;

  /** `depth` 0 is the whole text; 1 is a value inside it, which may match a key once more. */
  function lookup(core: string, depth: number): string {
    const direct = exact(core);
    if (direct !== undefined) return direct;
    if (!/\p{L}/u.test(core)) return core;
    for (const p of patternsOf(table)) {
      if (p.open && core.length > OPEN_MAX_LENGTH) continue;
      const m = p.regex.exec(core);
      if (!m) continue;
      const translated = exact(p.key);
      if (translated === undefined) continue;
      const values: Record<string, string> = {};
      p.names.forEach((name, i) => {
        const v = m[i + 1];
        const trimmed = v.trim();
        const inner = trimmed && depth === 0 ? lookup(trimmed, 1) : (exact(trimmed) ?? trimmed);
        values[name] = inner === trimmed ? v : v.replace(trimmed, inner);
      });
      return fill(translated, values);
    }
    return core;
  }

  return function translate(text: string): string {
    if (!text) return text;
    const hit = cache.get(text);
    if (hit !== undefined) return hit;
    const core = text.replace(/\s+/g, ' ').trim();
    let out = text;
    if (core) {
      const translated = lookup(core, 0);
      if (translated !== core) {
        const lead = /^\s/.test(text) ? ' ' : '';
        const trail = /\s$/.test(text) ? ' ' : '';
        out = lead + translated + trail;
      }
    }
    if (cache.size > MAX_CACHE) cache.clear();
    cache.set(text, out);
    return out;
  };
}
