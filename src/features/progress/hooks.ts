import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listLogs, saveLog } from '@/features/progress/api';
import { draftToLog, useWorkoutDraft } from '@/features/progress/draft-store';

export const progressKeys = {
  all: ['progress'] as const,
  logs: (gymId: string, memberId: string) => [...progressKeys.all, gymId, memberId] as const,
};

export function useWorkoutLogs(gymId: string, memberId: string) {
  return useQuery({
    queryKey: progressKeys.logs(gymId, memberId),
    queryFn: () => listLogs(gymId, memberId),
  });
}

/**
 * Uploads the workout in progress. The draft is only cleared once the server
 * has it, so a failed upload can be retried without losing anything.
 */
export function useFinishWorkout(memberId: string) {
  const queryClient = useQueryClient();
  const discard = useWorkoutDraft((s) => s.discard);

  return useMutation({
    mutationFn: async () => {
      const { draft } = useWorkoutDraft.getState();
      if (!draft) throw new Error('No workout in progress');
      await saveLog(draft.gymId, memberId, draftToLog(draft));
    },
    onSuccess: () => {
      discard();
      return queryClient.invalidateQueries({ queryKey: progressKeys.all });
    },
  });
}
