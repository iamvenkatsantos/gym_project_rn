import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

type Props = {
  /** How many are picked; shown as a badge on the tick. */
  count: number;
  disabled?: boolean;
};

/** Header tick that closes a picker screen whose picks save on tap, with the picked count. */
export function HeaderDoneButton({ count, disabled }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('Done, {count} assigned', { count })}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => router.back()}
      hitSlop={8}
      style={({ pressed }) => [styles.button, (pressed || disabled) && styles.dim]}>
      <Icon name="checkmark-circle" size={30} color="accent" />
      {count > 0 ? (
        <View
          style={[styles.badge, { backgroundColor: theme.primary, borderColor: theme.background }]}>
          <ThemedText
            type="smallBold"
            translate={false}
            maxFontSizeMultiplier={1}
            style={[styles.count, { color: theme.onPrimary }]}>
            {count > 99 ? '99+' : count}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: TapTarget,
    height: TapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: {
    opacity: 0.5,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    fontSize: 10,
    lineHeight: 12,
  },
});
