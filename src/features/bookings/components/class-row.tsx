import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Pill } from '@/components/pill';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { fillRate, spotsLeft } from '@/features/bookings/rules';
import type { GymClass } from '@/features/bookings/types';
import { formatRelativeDay, formatTime } from '@/lib/format';

type ClassRowProps = {
  gymClass: GymClass;
  /** Show the day as well as the time, for lists that span several days. */
  showDay?: boolean;
  highlighted?: boolean;
  badge?: ReactNode;
  action?: ReactNode;
};

export function ClassRow({ gymClass, showDay, highlighted, badge, action }: ClassRowProps) {
  const left = spotsLeft(gymClass);
  const rate = fillRate(gymClass);

  return (
    <Card highlighted={highlighted}>
      <View style={styles.top}>
        <View style={styles.time}>
          <ThemedText type="heading" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {formatTime(gymClass.startsAt)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {showDay ? formatRelativeDay(gymClass.startsAt) : `${gymClass.durationMinutes} min`}
          </ThemedText>
        </View>
        <View style={styles.body}>
          <ThemedText type="heading">{gymClass.title}</ThemedText>
          <View style={styles.meta}>
            <Icon name="person-circle-outline" size={16} />
            <ThemedText type="small" themeColor="textSecondary">
              {gymClass.trainerName}
              {showDay ? ` · ${gymClass.durationMinutes} min` : ''}
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.capacity}>
        <ProgressBar
          value={rate}
          color={left === 0 ? 'danger' : rate >= 0.75 ? 'warning' : 'primary'}
        />
        <View style={styles.capacityText}>
          {badge ?? (
            <Pill
              label={left === 0 ? 'Full' : `${left} spots left`}
              tone={left === 0 ? 'danger' : rate >= 0.75 ? 'warning' : 'neutral'}
            />
          )}
          <ThemedText type="small" themeColor="textSecondary">
            {gymClass.bookedCount}/{gymClass.capacity} booked
          </ThemedText>
        </View>
      </View>

      {action}
    </Card>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  time: {
    minWidth: 72,
    // With a large phone font the time would otherwise squeeze the class name.
    maxWidth: '35%',
  },
  body: {
    flex: 1,
    gap: Spacing.one,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  capacity: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  capacityText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
