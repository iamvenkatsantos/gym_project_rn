/**
 * CoreFit themes, light and dark, both built around the logo's green. The app follows the phone's
 * appearance unless the person picks one in Account. Gyms are often dimly lit and people use the app
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
