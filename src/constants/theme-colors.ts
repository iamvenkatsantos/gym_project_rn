/**
 * The theme colours, as plain data so the owner web dashboard can use them too (no React Native
 * here). `src/constants/theme.ts` builds the app's palettes from these.
 */

/** The gym's theme colour, picked by its owner. Green, the logo colour, is the default. */
export const ThemeColors = ['green', 'blue', 'purple', 'orange', 'pink'] as const;
export type ThemeColorId = (typeof ThemeColors)[number];
export const DefaultThemeColor: ThemeColorId = 'green';

export type Shades = {
  text: string;
  textSecondary: string;
  background: string;
  backgroundElement: string;
  backgroundSelected: string;
  border: string;
  primary: string;
  onPrimary: string;
  accent: string;
};

/**
 * Each colour swaps the fill (`primary`), the readable text colour (`accent`) and gives the greys
 * a faint tint of the same hue (the green greys with their hue turned). Status colours stay put so
 * success, warning and danger mean the same in every theme. Every `accent` passes 4.5:1 on its
 * background and every `onPrimary` passes 4.5:1 on its `primary`.
 */
const tints: Record<
  Exclude<ThemeColorId, 'green'>,
  { label: string; dark: Shades; light: Shades }
> = {
  blue: {
    label: 'Blue',
    dark: {
      text: '#F2F3F5',
      textSecondary: '#9B9FA4',
      background: '#0D0F11',
      backgroundElement: '#17191C',
      backgroundSelected: '#22262A',
      border: '#2A2E33',
      primary: '#3B9EFF',
      onPrimary: '#04172E',
      accent: '#5AAEFF',
    },
    light: {
      text: '#101418',
      textSecondary: '#5B6168',
      background: '#F3F4F6',
      backgroundElement: '#FFFFFF',
      backgroundSelected: '#E4E8EC',
      border: '#D9DDE2',
      primary: '#3B9EFF',
      onPrimary: '#04172E',
      accent: '#1D5FD0',
    },
  },
  purple: {
    label: 'Purple',
    dark: {
      text: '#F3F2F5',
      textSecondary: '#9E9BA4',
      background: '#0E0D11',
      backgroundElement: '#18171C',
      backgroundSelected: '#24222A',
      border: '#2D2A33',
      primary: '#A78BFA',
      onPrimary: '#1A0B3D',
      accent: '#B79CFF',
    },
    light: {
      text: '#121018',
      textSecondary: '#5F5B68',
      background: '#F4F3F6',
      backgroundElement: '#FFFFFF',
      backgroundSelected: '#E6E4EC',
      border: '#DCD9E2',
      primary: '#A78BFA',
      onPrimary: '#1A0B3D',
      accent: '#6D28D9',
    },
  },
  orange: {
    label: 'Orange',
    dark: {
      text: '#F5F3F2',
      textSecondary: '#A49F9B',
      background: '#110F0D',
      backgroundElement: '#1C1917',
      backgroundSelected: '#2A2522',
      border: '#332E2A',
      primary: '#FF8A3D',
      onPrimary: '#2B1100',
      accent: '#FF9A55',
    },
    light: {
      text: '#181310',
      textSecondary: '#68605B',
      background: '#F6F4F3',
      backgroundElement: '#FFFFFF',
      backgroundSelected: '#ECE7E4',
      border: '#E2DDD9',
      primary: '#FF8A3D',
      onPrimary: '#2B1100',
      accent: '#C2410C',
    },
  },
  pink: {
    label: 'Pink',
    dark: {
      text: '#F5F2F3',
      textSecondary: '#A49B9F',
      background: '#110D0F',
      backgroundElement: '#1C1719',
      backgroundSelected: '#2A2225',
      border: '#332A2E',
      primary: '#FF6FA5',
      onPrimary: '#33061A',
      accent: '#FF85B3',
    },
    light: {
      text: '#181013',
      textSecondary: '#685B60',
      background: '#F6F3F4',
      backgroundElement: '#FFFFFF',
      backgroundSelected: '#ECE4E7',
      border: '#E2D9DD',
      primary: '#FF6FA5',
      onPrimary: '#33061A',
      accent: '#BE185D',
    },
  },
};

/** Name shown under each colour swatch. */
export const ThemeColorLabels: Record<ThemeColorId, string> = {
  green: 'Green',
  blue: tints.blue.label,
  purple: tints.purple.label,
  orange: tints.orange.label,
  pink: tints.pink.label,
};

export function isThemeColor(value: unknown): value is ThemeColorId {
  return typeof value === 'string' && (ThemeColors as readonly string[]).includes(value);
}


/** The colours a theme colour swaps, or null for green (the base palette). */
export function themeShades(id: ThemeColorId, scheme: 'light' | 'dark'): Shades | null {
  return id === 'green' ? null : tints[id][scheme];
}
