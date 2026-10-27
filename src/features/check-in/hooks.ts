import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { attendanceKeys } from '@/features/attendance/hooks';
import type { AttendeeRole } from '@/features/attendance/types';
import {
  getCheckInQr,
  getCheckInRules,
  getDisplayCode,
  resetCheckInCode,
  saveCheckInSettings,
  scanCheckIn,
  type CheckInSettings,
} from '@/features/check-in/api';

export const checkInKeys = {
  all: ['check-in'] as const,
  rules: (gymId: string) => [...checkInKeys.all, gymId, 'rules'] as const,
  qr: (gymId: string) => [...checkInKeys.all, gymId, 'qr'] as const,
  display: (displayKey: string) => [...checkInKeys.all, 'display', displayKey] as const,
};

/** Scans in or out. Home's check-in card and the reports refresh straight after. */
export function useScanCheckIn(user: { id: string; role: AttendeeRole }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ gymId, code }: { gymId: string; code: string }) =>
      scanCheckIn(gymId, code, user),
    onSettled: () => queryClient.invalidateQueries({ queryKey: attendanceKeys.all }),
  });
}

export function useCheckInRules(gymId: string) {
  return useQuery({ queryKey: checkInKeys.rules(gymId), queryFn: () => getCheckInRules(gymId) });
}

export function useCheckInQr(gymId: string) {
  return useQuery({ queryKey: checkInKeys.qr(gymId), queryFn: () => getCheckInQr(gymId) });
}

/** The live code, fetched again the moment it changes. */
export function useDisplayCode(displayKey: string | undefined) {
  return useQuery({
    queryKey: checkInKeys.display(displayKey ?? ''),
    queryFn: () => getDisplayCode(displayKey!),
    enabled: !!displayKey,
    refetchInterval: (query) => {
      const refreshAt = query.state.data?.refreshAt;
      // A moment after the server's window turns, so the new code is ready.
      return refreshAt ? Math.max(1000, Date.parse(refreshAt) - Date.now() + 500) : 5000;
    },
    refetchIntervalInBackground: false,
  });
}

export function useSaveCheckInSettings(gymId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: CheckInSettings) => saveCheckInSettings(gymId, settings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: checkInKeys.all }),
  });
}

export function useResetCheckInCode(gymId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (which: 'poster' | 'display') => resetCheckInCode(gymId, which),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: checkInKeys.all }),
  });
}
