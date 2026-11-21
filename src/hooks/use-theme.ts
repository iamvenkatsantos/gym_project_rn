import { useColorScheme } from 'react-native';

import { getPalette, type ColorScheme } from '@/constants/theme';
import { selectActiveGym, useAuthStore } from '@/features/auth/auth-store';
import { useAppearance } from '@/features/appearance/appearance-store';

/** Light or dark: the person's choice in Account, otherwise the phone's setting. */
export function useColorSchemeName(): ColorScheme {
  const system = useColorScheme();
  const choice = useAppearance((s) => s.choice);
  if (choice !== 'system') return choice;
  return system === 'light' ? 'light' : 'dark';
}

/** The palette for the current light/dark mode in the active gym's theme colour (green with none). */
export function useTheme() {
  const scheme = useColorSchemeName();
  const color = useAuthStore((s) => selectActiveGym(s)?.themeColor);
  return getPalette(scheme, color);
}
