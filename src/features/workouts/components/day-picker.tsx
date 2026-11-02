import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, TapTarget } from '@/constants/theme';
import { toggleDay, Weekdays } from '@/features/workouts/schedule';
import { useTheme } from '@/hooks/use-theme';

type DayPickerProps = {
  /** Read by screen readers before each day, e.g. "Ravi's days". */
  label: string;
  days: number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
};

/** Seven day buttons, Monday first. None picked means any day. */
export function DayPicker({ label, days, onChange, disabled = false }: DayPickerProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {Weekdays.map(({ day, short, letter }) => {
        const selected = days.includes(day);
        return (
          <Pressable
            key={day}
            accessibilityRole="checkbox"
            accessibilityLabel={`${label}: ${short}`}
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(toggleDay(days, day))}
            style={({ pressed }) => [
              styles.day,
              {
                backgroundColor: selected ? theme.primary : theme.backgroundElement,
                borderColor: selected ? theme.primary : theme.border,
              },
              (pressed || disabled) && styles.dim,
            ]}>
            <ThemedText
              type="smallBold"
              themeColor={selected ? 'onPrimary' : 'text'}
              maxFontSizeMultiplier={1}>
              {letter}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 4,
  },
  day: {
    flex: 1,
    maxWidth: TapTarget,
    minHeight: TapTarget,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: {
    opacity: 0.6,
  },
});
