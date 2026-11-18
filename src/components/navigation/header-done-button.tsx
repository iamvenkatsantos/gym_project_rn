import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/icon';
import { Radius } from '@/constants/theme';
import { useT } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';

/**
 * A round tick in the header that finishes a screen whose changes already saved on tap
 * (assign a plan), so the way out is always in reach instead of under a long list.
 */
export function HeaderDoneButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const t = useT();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('Done')}
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.primary },
        pressed && styles.pressed,
      ]}>
      <Icon name="checkmark" size={22} color="onPrimary" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
