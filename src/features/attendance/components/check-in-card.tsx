import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCheckIn, useMyAttendance } from '@/features/attendance/hooks';
import { attendanceStatus, attendanceTimes } from '@/features/attendance/rules';
import type { AttendeeRole } from '@/features/attendance/types';

const hint: Record<AttendeeRole, string> = {
  member: 'Check in when you arrive to start your workout.',
  trainer: 'Check in when you start your shift.',
};

/** Today's check-in and check-out, on the member's and the trainer's home. */
export function CheckInCard({
  gymId,
  userId,
  role,
}: {
  gymId: string;
  userId: string;
  role: AttendeeRole;
}) {
  const today = useMyAttendance(gymId, userId);
  const toggle = useCheckIn(gymId, userId, role);
  const status = attendanceStatus(today.data);

  return (
    <Card highlighted={status === 'inGym'}>
      <View style={styles.row}>
        <Icon
          name={status === 'inGym' ? 'location' : 'location-outline'}
          size={24}
          color={status === 'inGym' ? 'primary' : 'textSecondary'}
        />
        <View style={styles.flex}>
          <ThemedText type="smallBold">
            {status === 'inGym'
              ? 'Checked in'
              : status === 'left'
                ? 'Checked out'
                : 'Not checked in'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {today.isPending ? 'Loading…' : today.data ? attendanceTimes(today.data) : hint[role]}
          </ThemedText>
        </View>
        {status === 'inGym' ? <Pill label="In gym" tone="success" /> : null}
      </View>
      {status === 'inGym' ? (
        <Button
          label="Check out"
          icon="log-out-outline"
          variant="secondary"
          loading={toggle.isPending}
          onPress={() => toggle.mutate('out')}
        />
      ) : (
        <Button
          label={status === 'left' ? 'Check in again' : 'Check in'}
          icon="log-in-outline"
          disabled={today.isPending}
          loading={toggle.isPending}
          onPress={() => toggle.mutate('in')}
        />
      )}
      {toggle.error ? (
        <ThemedText type="small" themeColor="danger">
          Couldn&apos;t save: {toggle.error.message}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
});
