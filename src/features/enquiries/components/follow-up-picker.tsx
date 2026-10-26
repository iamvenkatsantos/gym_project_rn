import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/chip';
import { Stepper } from '@/components/stepper';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { DateStrip } from '@/features/bookings/components/date-strip';
import { atMinutes, formatClock, upcomingDays } from '@/features/bookings/rules';
import { defaultFollowUp } from '@/features/enquiries/rules';
import { formatDateTime } from '@/lib/format';

/** Picks when to follow up next: a day in the next three weeks and a time, or none. */
export function FollowUpPicker({
  value,
  onChange,
  label = 'Next follow-up',
}: {
  value: Date | null;
  onChange: (value: Date | null) => void;
  label?: string;
}) {
  const days = useMemo(() => upcomingDays(21), []);
  const minutes = value ? value.getHours() * 60 + value.getMinutes() : 10 * 60;

  return (
    <View style={styles.field}>
      <ThemedText type="label" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={styles.chips}>
        <Chip
          label="Set a time"
          selected={value !== null}
          onPress={() => onChange(value ?? defaultFollowUp())}
        />
        <Chip label="No follow-up" selected={value === null} onPress={() => onChange(null)} />
      </View>
      {value ? (
        <>
          <DateStrip
            days={days}
            selected={value}
            onSelect={(day) => onChange(atMinutes(day, minutes))}
          />
          <Stepper
            label="Follow-up time"
            value={minutes}
            step={30}
            min={6 * 60}
            max={22 * 60}
            format={formatClock}
            onChange={(next) => onChange(atMinutes(value, next))}
          />
          <ThemedText type="small" themeColor="textSecondary">
            We&apos;ll remind you on {formatDateTime(value.toISOString())}.
          </ThemedText>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
