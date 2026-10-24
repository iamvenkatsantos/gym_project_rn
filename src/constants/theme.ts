/**
 * Dark-first CoreFit theme, green accent taken from the logo. Gyms are often dimly lit and people use the app
 * between sets, so the UI favours high contrast and large tap targets.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  text: '#F5F5F7',
  textSecondary: '#9A9AA5',
  background: '#0B0B0F',
  backgroundElement: '#17171E',
  backgroundSelected: '#23232C',
  border: '#2A2A33',
  primary: '#3DDC5C',
  onPrimary: '#0B0B0F',
  success: '#2DD4BF',
  warning: '#FBBF24',
  danger: '#F87171',
} as const;

export type ThemeColor = keyof typeof Colors;

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

export const MaxContentWidth = 800;
