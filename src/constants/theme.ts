/**
 * CoreFit themes, light and dark, built around the logo's green by default. The app follows the phone's
 * appearance unless the person picks one in Account, where they can also pick a theme colour
 * (`ThemeColors`). Gyms are often dimly lit and people use the app
 * between sets, so both themes favour high contrast and large tap targets.
 */

import '@/global.css';

import { Platform } from 'react-native';

/** The logo green. Fills only: buttons, selected chips, badges. */
export const BrandGreen = '#3DDC5C';

const dark = {
  text: '#F2F5F3',
  textSecondary: '#9BA49F',
  background: '#0D1110',
  backgroundElement: '#171C1A',
  backgroundSelected: '#222A27',
  border: '#2A3330',
  /** Fill colour for primary buttons, selected chips and badges. */
  primary: BrandGreen,
  /** Text and icons on top of `primary`. */
  onPrimary: '#06200D',
  /** Green for text, icons and outlines, readable on the background. */
  accent: '#4BE36A',
  success: '#2DD4BF',
  warning: '#FBBF24',
  danger: '#F87171',
};

const light: typeof dark = {
  text: '#101814',
  textSecondary: '#5B6862',
  background: '#F3F6F4',
  backgroundElement: '#FFFFFF',
  backgroundSelected: '#E4ECE7',
  border: '#D9E2DC',
  primary: BrandGreen,
  onPrimary: '#06200D',
  // The logo green is too pale for text on white, so text uses a deeper shade of it.
  accent: '#15803D',
  success: '#0F766E',
  warning: '#B45309',
  danger: '#DC2626',
};

export const Colors = { light, dark } as const;

/** The colour choices in Account → Appearance. Green, the logo colour, is the default. */
export const ThemeColors = ['green', 'blue', 'purple', 'orange', 'pink'] as const;
export type ThemeColorId = (typeof ThemeColors)[number];
export const DefaultThemeColor: ThemeColorId = 'green';

type Shades = Pick<
  Palette,
  | 'text'
  | 'textSecondary'
  | 'background'
  | 'backgroundElement'
  | 'backgroundSelected'
  | 'border'
  | 'primary'
  | 'onPrimary'
  | 'accent'
>;

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

const cache = new Map<string, Palette>();

/** The full palette for light or dark in one of the theme colours (unknown ids fall back to green). */
export function getPalette(scheme: ColorScheme, color: ThemeColorId = DefaultThemeColor): Palette {
  const id = isThemeColor(color) ? color : DefaultThemeColor;
  if (id === 'green') return Colors[scheme];
  const key = `${id}-${scheme}`;
  let palette = cache.get(key);
  if (!palette) {
    palette = { ...Colors[scheme], ...tints[id][scheme] };
    cache.set(key, palette);
  }
  return palette;
}

/**
 * The launch screen's background, in both themes. Must match `expo-splash-screen`'s
 * `backgroundColor` in app.json so the animated intro takes over without a flash.
 */
export const SplashBackground = '#0B0B0F';

export type ColorScheme = keyof typeof Colors;
export type Palette = typeof dark;
export type ThemeColor = keyof Palette;

/** A colour from the palette with transparency, e.g. a soft tint behind an icon. */
export function withAlpha(hex: string, alpha: number) {
  const value = Math.round(Math.min(Math.max(alpha, 0), 1) * 255);
  return `${hex}${value.toString(16).padStart(2, '0')}`;
}

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 8,
  medium: 14,
  large: 20,
  pill: 999,
} as const;

/** Minimum touch target, above the 44pt/48dp platform guidelines. */
export const TapTarget = 52;

/**
 * How far text follows the phone's font size setting. Some phones (vivo/iQOO) ship with a large
 * font by default; beyond this, rows and tiles built for a 360dp screen break words apart.
 */
export const MaxFontScale = 1.3;

export const MaxContentWidth = 800;
