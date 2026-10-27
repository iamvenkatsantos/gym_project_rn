import { Alert } from 'react-native';

import { checkOut } from '@/features/attendance/api';
import { attendanceKeys } from '@/features/attendance/hooks';
import { attendanceStatus } from '@/features/attendance/rules';
import type { AttendanceDay } from '@/features/attendance/types';
import { queryClient } from '@/lib/query-client';

/**
 * After a member finishes a workout: "Done for today?". Asked rather than done,
 * since they may stay for cardio or a class. Only while they're checked in.
 */
export function offerCheckOut(gymId: string, userId: string) {
  const today = queryClient.getQueryData<AttendanceDay | null>(attendanceKeys.mine(gymId, userId));
  if (attendanceStatus(today) !== 'inGym') return;
  Alert.alert('Done for today?', 'Check out now, or scan the QR on your way out.', [
    { text: 'Not yet', style: 'cancel' },
    {
      text: 'Check out',
      onPress: () =>
        checkOut(gymId, userId)
          .catch((error: Error) => Alert.alert('Couldn’t check out', error.message))
          .finally(() => queryClient.invalidateQueries({ queryKey: attendanceKeys.all })),
    },
  ]);
}
