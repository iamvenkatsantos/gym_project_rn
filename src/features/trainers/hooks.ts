import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  bookSession,
  getTrainer,
  listBusySlots,
  listSessions,
  listTrainers,
  updateSessionStatus,
} from '@/features/trainers/api';
import type { TrainerSession } from '@/features/trainers/types';

export const trainerKeys = {
  all: ['trainers'] as const,
  list: (gymId: string) => [...trainerKeys.all, gymId, 'list'] as const,
  detail: (gymId: string, trainerId: string) =>
    [...trainerKeys.all, gymId, 'detail', trainerId] as const,
  busy: (trainerId: string, from: string) => [...trainerKeys.all, 'busy', trainerId, from] as const,
  sessions: (gymId: string, filter: { memberId?: string; trainerId?: string }) =>
    [...trainerKeys.all, gymId, 'sessions', filter] as const,
};

export function useTrainers(gymId: string) {
  return useQuery({ queryKey: trainerKeys.list(gymId), queryFn: () => listTrainers(gymId) });
}

export function useTrainer(gymId: string, trainerId: string) {
  return useQuery({
    queryKey: trainerKeys.detail(gymId, trainerId),
    queryFn: () => getTrainer(gymId, trainerId),
  });
}

export function useBusySlots(trainerId: string, from: Date, to: Date) {
  return useQuery({
    queryKey: trainerKeys.busy(trainerId, from.toISOString()),
    queryFn: () => listBusySlots(trainerId, from, to),
  });
}

export function useSessions(gymId: string, filter: { memberId?: string; trainerId?: string }) {
  return useQuery({
    queryKey: trainerKeys.sessions(gymId, filter),
    queryFn: () => listSessions(gymId, filter),
  });
}

export function useBookSession(gymId: string, memberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ trainerId, startsAt }: { trainerId: string; startsAt: string }) =>
      bookSession(gymId, trainerId, memberId, startsAt),
    onSettled: () => queryClient.invalidateQueries({ queryKey: trainerKeys.all }),
  });
}

export function useUpdateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      status,
    }: {
      sessionId: string;
      status: Exclude<TrainerSession['status'], 'booked'>;
    }) => updateSessionStatus(sessionId, status),
    onSettled: () => queryClient.invalidateQueries({ queryKey: trainerKeys.all }),
  });
}
