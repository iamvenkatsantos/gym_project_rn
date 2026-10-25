import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  announceWorkoutStart,
  checkIn,
  checkOut,
  getAttendanceReport,
  getMyAttendance,
  listDayAttendance,
} from '@/features/attendance/api';
import type { AttendeeRole } from '@/features/attendance/types';

export const attendanceKeys = {
  all: ['attendance'] as const,
  mine: (gymId: string, userId: string) => [...attendanceKeys.all, gymId, 'mine', userId] as const,
  day: (gymId: string, daysAgo: number) => [...attendanceKeys.all, gymId, 'day', daysAgo] as const,
  report: (gymId: string, days: number) => [...attendanceKeys.all, gymId, 'report', days] as const,
};

export function useMyAttendance(gymId: string, userId: string) {
  return useQuery({
    queryKey: attendanceKeys.mine(gymId, userId),
    queryFn: () => getMyAttendance(gymId, userId),
  });
}

export function useCheckIn(gymId: string, userId: string, role: AttendeeRole) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (direction: 'in' | 'out') =>
      direction === 'in' ? checkIn(gymId, userId, role) : checkOut(gymId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attendanceKeys.all }),
  });
}

export function useAnnounceWorkoutStart(gymId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workout: { clientId: string; title: string }) =>
      announceWorkoutStart(gymId, workout),
    // A refusal usually means they checked out on another phone.
    onError: () => queryClient.invalidateQueries({ queryKey: attendanceKeys.all }),
  });
}

/** A day's attendance list, `daysAgo` days back from today in the gym's time zone. */
export function useDayAttendance(gymId: string, daysAgo: number) {
  return useQuery({
    queryKey: attendanceKeys.day(gymId, daysAgo),
    queryFn: () => listDayAttendance(gymId, daysAgo),
  });
}

export function useAttendanceReport(gymId: string, days: number) {
  return useQuery({
    queryKey: attendanceKeys.report(gymId, days),
    queryFn: () => getAttendanceReport(gymId, days),
  });
}
