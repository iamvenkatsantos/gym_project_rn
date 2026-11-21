import { themeShades, type ThemeColorId } from '@/constants/theme-colors';

const STYLE_ID = 'gym-theme';

type Scheme = 'light' | 'dark';

function declarations(color: ThemeColorId, scheme: Scheme) {
  const s = themeShades(color, scheme);
  if (!s) return '';
  return (
    `--text:${s.text};--text-secondary:${s.textSecondary};--background:${s.background};` +
    `--surface:${s.backgroundElement};--selected:${s.backgroundSelected};--border:${s.border};` +
    `--primary:${s.primary};--on-primary:${s.onPrimary};--accent:${s.accent};`
  );
}

/** CSS that swaps the dashboard's colour variables for the gym's theme colour; empty for green. */
export function gymThemeCss(color: ThemeColorId) {
  const light = declarations(color, 'light');
  if (!light) return '';
  return (
    `:root{${light}}` +
    `@media (prefers-color-scheme: dark){:root{${declarations(color, 'dark')}}}`
  );
}

/** Shows the dashboard in the gym's theme colour (set by its owner in the app). */
export function applyGymTheme(color: ThemeColorId) {
  let el = document.getElementById(STYLE_ID);
  const css = gymThemeCss(color);
  if (!css) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

export function clearGymTheme() {
  document.getElementById(STYLE_ID)?.remove();
}
