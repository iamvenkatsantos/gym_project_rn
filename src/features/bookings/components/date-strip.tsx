import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { isSameDay } from '@/features/bookings/rules';
import { useTheme } from '@/hooks/use-theme';
import { formatWeekday } from '@/lib/format';

type DateStripProps = {
  days: Date[];
  selected: Date;
  onSelect: (day: Date) => void;
};

/** Horizontal day picker, the usual entry point for browsing a class timetable. */
export function DateStrip({ days, selected, onSelect }: DateStripProps) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {days.map((day) => {
        const active = isSameDay(day, selected);
        return (
          <Pressable
            key={day.toISOString()}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={day.toDateString()}
            onPress={() => onSelect(day)}
            style={[
              styles.day,
              { backgroundColor: active ? theme.primary : theme.backgroundElement },
            ]}>
            <ThemedText type="label" themeColor={active ? 'onPrimary' : 'textSecondary'}>
              {formatWeekday(day)}
            </ThemedText>
            <ThemedText type="heading" themeColor={active ? 'onPrimary' : 'text'}>
              {day.getDate()}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.two,
  },
  day: {
    width: TapTarget + 4,
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.medium,
    alignItems: 'center',
    gap: Spacing.half,
  },
});
