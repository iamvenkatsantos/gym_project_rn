import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { dayLabel, formatMinutes } from '@/features/attendance/rules';
import { timeOfDay } from '@/features/check-in/rules';
import { reasonLabel, statusPill } from '@/features/trainer-hours/rules';
import type { WorkPermission } from '@/features/trainer-hours/types';

/** A permission request: when, why and its answer. Owners see who asked. */
export function PermissionCard({
  permission: p,
  showName,
  children,
}: {
  permission: WorkPermission;
  showName?: boolean;
  /** Buttons under the request, e.g. Approve and Reject. */
  children?: ReactNode;
}) {
  const pill = statusPill[p.status];
  return (
    <Card>
      <View style={styles.top}>
        <View style={styles.flex}>
          <ThemedText type="smallBold">
            {showName ? p.trainerName : reasonLabel(p.reason)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {dayLabel(p.day)}, {timeOfDay(p.startsAt)} – {timeOfDay(p.endsAt)} (
            {formatMinutes(p.endsAt - p.startsAt)})
          </ThemedText>
          {showName ? (
            <ThemedText type="small" themeColor="textSecondary">
              {reasonLabel(p.reason)}
            </ThemedText>
          ) : null}
          {p.note ? <ThemedText type="small">{p.note}</ThemedText> : null}
        </View>
        <Pill label={pill.label} tone={pill.tone} />
      </View>
      {children ? <View style={styles.actions}>{children}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
    gap: Spacing.half,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
