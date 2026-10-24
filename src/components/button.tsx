import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: IconName;
  size?: 'regular' | 'compact';
  disabled?: boolean;
  loading?: boolean;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  size = 'regular',
  disabled,
  loading,
}: ButtonProps) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';
  const inactive = disabled || loading;
  const textColor = isPrimary ? 'onPrimary' : variant === 'danger' ? 'danger' : 'text';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        size === 'compact' && styles.compact,
        isPrimary
          ? { backgroundColor: theme.primary }
          : { borderColor: theme.border, borderWidth: 1 },
        disabled && !isPrimary && { backgroundColor: theme.backgroundSelected, borderWidth: 0 },
        disabled && isPrimary && { backgroundColor: theme.backgroundSelected },
        pressed && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={theme[textColor]} />
      ) : (
        <>
          {icon ? (
            <Icon name={icon} size={18} color={disabled ? 'textSecondary' : textColor} />
          ) : null}
          <ThemedText
            type="smallBold"
            themeColor={disabled ? 'textSecondary' : textColor}
            style={styles.label}>
            {label}
          </ThemedText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: TapTarget,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
  },
  label: {
    fontSize: 15,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
});
