import { View } from 'react-native';

import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { DefaultThemeColor, Spacing } from '@/constants/theme';
import { selectActiveGym, useAuthStore } from '@/features/auth/auth-store';
import { useSetGymThemeColor } from '@/features/gyms/hooks';
import { alert } from '@/i18n/alert';
import { useTheme } from '@/hooks/use-theme';

import { ThemeColorPicker } from './theme-color-picker';

/** Owners pick the colour of their gym's app and dashboard; nobody else sees this. */
export function GymThemeColor() {
  const gym = useAuthStore(selectActiveGym);
  const theme = useTheme();
  const save = useSetGymThemeColor(gym?.gymId ?? '');
  if (!gym || gym.role !== 'owner') return null;

  return (
    <View style={{ gap: Spacing.two }}>
      <SectionHeader title="Gym colour" />
      <ThemedText type="small" style={{ color: theme.textSecondary }}>
        Everyone at this gym sees it.
      </ThemedText>
      <ThemeColorPicker
        value={gym.themeColor ?? DefaultThemeColor}
        disabled={save.isPending}
        onChange={(color) =>
          save.mutate(color, { onError: (e) => alert("Couldn't save the colour", e.message) })
        }
      />
    </View>
  );
}
