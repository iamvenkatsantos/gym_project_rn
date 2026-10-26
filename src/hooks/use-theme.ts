import { useColorScheme } from 'react-native';

import { Colors, type ColorScheme } from '@/constants/theme';
import { useAppearance } from '@/features/appearance/appearance-store';

/** Light or dark: the person's choice in Account, otherwise the phone's setting. */
export function useColorSchemeName(): ColorScheme {
  const system = useColorScheme();
  const choice = useAppearance((s) => s.choice);
  if (choice !== 'system') return choice;
  return system === 'light' ? 'light' : 'dark';
}

export function useTheme() {
  return Colors[useColorSchemeName()];
}
