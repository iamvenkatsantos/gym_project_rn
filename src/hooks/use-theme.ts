import { useColorScheme } from 'react-native';

import { getPalette, type ColorScheme } from '@/constants/theme';
import { useAppearance } from '@/features/appearance/appearance-store';

/** Light or dark: the person's choice in Account, otherwise the phone's setting. */
export function useColorSchemeName(): ColorScheme {
  const system = useColorScheme();
  const choice = useAppearance((s) => s.choice);
  if (choice !== 'system') return choice;
  return system === 'light' ? 'light' : 'dark';
}

/** The palette for the current light/dark mode in the person's theme colour. */
export function useTheme() {
  const scheme = useColorSchemeName();
  const color = useAppearance((s) => s.color);
  return getPalette(scheme, color);
}
