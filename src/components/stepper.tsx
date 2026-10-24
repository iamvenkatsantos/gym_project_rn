import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type StepperProps = {
  /** Read by screen readers, e.g. "Back squat sets". */
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  /** How the value is shown, e.g. as a time or with a unit. */
  format?: (value: number) => string;
};

/** A minus / value / plus control. Easier than typing between sets, and can't go out of range. */
export function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = -Infinity,
  max = Infinity,
  format = String,
}: StepperProps) {
  const theme = useTheme();
  const shown = format(value);

  const button = (by: number, icon: 'remove' | 'add', name: string) => {
    const disabled = by < 0 ? value <= min : value >= max;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name} ${label}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        hitSlop={4}
        onPress={() => onChange(Math.min(max, Math.max(min, value + by)))}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.backgroundSelected },
          pressed && styles.pressed,
        ]}>
        <Icon name={icon} size={18} color={disabled ? 'border' : 'text'} />
      </Pressable>
    );
  };

  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityValue={{ text: shown }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) =>
        onChange(
          Math.min(
            max,
            Math.max(min, value + (e.nativeEvent.actionName === 'increment' ? step : -step)),
          ),
        )
      }
      style={[styles.row, { borderColor: theme.border }]}>
      {button(-step, 'remove', 'Decrease')}
      <ThemedText type="smallBold" style={styles.value} numberOfLines={1}>
        {shown}
      </ThemedText>
      {button(step, 'add', 'Increase')}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.small,
    padding: Spacing.half,
    gap: Spacing.half,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: Radius.small - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    flex: 1,
    minWidth: 44,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
