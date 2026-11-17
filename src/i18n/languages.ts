/**
 * The languages the app speaks. English is the source: every key in `strings/` is the English
 * text itself, and anything without a translation shows in English.
 *
 * To add a language: add it here with the next `column`, then add that column to every entry
 * in `strings/` (run `node scripts/i18n-extract.mjs` to see what's missing).
 */
export type Language = 'en' | 'ta' | 'hi';

export type LanguageInfo = {
  code: Language;
  /** The language's own name, so people find it whatever language the app is in. */
  nativeName: string;
  /** Locale for dates and numbers. Undefined keeps the phone's own (English stays as before). */
  locale: string | undefined;
  /** Index into each `strings/` entry. English has none: it is the key. */
  column: number | null;
};

export const LANGUAGES: LanguageInfo[] = [
  { code: 'en', nativeName: 'English', locale: undefined, column: null },
  { code: 'ta', nativeName: 'தமிழ்', locale: 'ta-IN', column: 0 },
  { code: 'hi', nativeName: 'हिन्दी', locale: 'hi-IN', column: 1 },
];

export function languageInfo(code: Language): LanguageInfo {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

/** The phone's language if the app speaks it, else English. */
export function deviceLanguage(): Language {
  let tag = '';
  try {
    tag = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
  } catch {
    // No Intl: stay in English.
  }
  const base = tag.toLowerCase().split(/[-_]/)[0];
  return LANGUAGES.some((l) => l.code === base) ? (base as Language) : 'en';
}
