import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Role } from '@/features/auth/types';
import {
  listGymLogs,
  listHistory,
  listLogs,
  replyToWorkout,
  saveLog,
} from '@/features/progress/api';
import { offlineError } from '@/lib/network';
import { draftToLog, useWorkoutDraft } from '@/features/progress/draft-store';

export const progressKeys = {
  all: ['progress'] as const,
  logs: (gymId: string, memberId: string) => [...progressKeys.all, gymId, memberId] as const,
  gym: (gymId: string, viewerId: string) => [...progressKeys.all, gymId, 'gym', viewerId] as const,
  history: (gymId: string, memberId: string) =>
    [...progressKeys.all, gymId, memberId, 'history'] as const,
};

export function useWorkoutLogs(gymId: string, memberId: string) {
  return useQuery({
    queryKey: progressKeys.logs(gymId, memberId),
    queryFn: () => listLogs(gymId, memberId),
  });
}

/** Someone's workouts from every gym the viewer may see; other gyms' logs are labelled. */
export function useWorkoutHistory(gymId: string, memberId: string) {
  return useQuery({
    queryKey: progressKeys.history(gymId, memberId),
    queryFn: () => listHistory(gymId, memberId),
  });
}

/** Other people's workouts the viewer may see, by their role at the gym. */
export function useGymWorkoutLogs(gymId: string, viewer: { id: string; role: Role }) {
  return useQuery({
    queryKey: progressKeys.gym(gymId, viewer.id),
    queryFn: () => listGymLogs(gymId, viewer),
  });
}

const SAVE_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number, error: Error): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(error), ms);
    promise.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

/**
 * Uploads the workout in progress. The draft is only cleared once the server
 * has it, so a failed upload can be retried without losing anything.
 */
export function useFinishWorkout(memberId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { draft } = useWorkoutDraft.getState();
      if (!draft) throw new Error('No workout in progress');
      // The save is idempotent (client_id), so a timed-out try is safe to retry.
      await withTimeout(
        saveLog(draft.gymId, memberId, draftToLog(draft)),
        SAVE_TIMEOUT_MS,
        offlineError(new Error('Saving the workout timed out')),
      );
    },
    // The screen leaves first, then the draft is cleared: clearing it while the workout
    // screen is open unmounts it before it can navigate.
    // Not awaited: the mutation stays pending until this promise settles, and the refetches of
    // every progress query kept the Finish button spinning long after the workout was saved.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: progressKeys.all });
    },
  });
}

/** A trainer's reply to one of their member's workouts. */
export function useReplyToWorkout(gymId: string, memberId: string, byName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, text }: { clientId: string; text: string }) =>
      replyToWorkout(gymId, memberId, clientId, text, byName),
    onSettled: () => queryClient.invalidateQueries({ queryKey: progressKeys.all }),
  });
}
