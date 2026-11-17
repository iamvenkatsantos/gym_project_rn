/**
 * The locale for dates and numbers, set from the app's language (`src/i18n`). Undefined means
 * the phone's own locale. Kept here, with no app imports, so the web dashboard can share
 * `format.ts`.
 */
let current: string | undefined;

export function setAppLocale(locale: string | undefined) {
  current = locale;
}

export function appLocale() {
  return current;
}
