import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { coachingKeys, useTrainerLinks } from '@/features/coaching/hooks';
import { notificationKeys } from '@/features/notifications/hooks';
import {
  createSelfPlan,
  deleteSelfWorkout,
  getSelfPrefs,
  saveSelfWorkout,
  setSelfWorkouts,
} from '@/features/self-workouts/api';
import { selfWorkoutsOn } from '@/features/self-workouts/rules';
import type { SelfPlan, SelfPrefs } from '@/features/self-workouts/types';
import { useWorkouts, workoutKeys } from '@/features/workouts/hooks';

export const selfKeys = {
  all: ['self-workouts'] as const,
  prefs: (gymId: string, memberId: string) => [...selfKeys.all, gymId, memberId] as const,
};

function useInvalidateSelf() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: selfKeys.all }),
      queryClient.invalidateQueries({ queryKey: workoutKeys.all }),
      queryClient.invalidateQueries({ queryKey: coachingKeys.all }),
      queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
    ]);
}

/** Whether the member may plan their own workouts, from their trainer links. */
export function useSelfWorkoutsOn(gymId: string, memberId: string) {
  const links = useTrainerLinks(gymId, { memberId });
  return { ...links, on: links.data ? selfWorkoutsOn(links.data, memberId) : undefined };
}

/** The member's own plans at the gym, as anyone allowed to see them sees them. */
export function useSelfPlans(gymId: string, memberId: string) {
  const workouts = useWorkouts(gymId);
  return {
    ...workouts,
    plans: workouts.data?.filter((w) => w.isSelf && w.trainerId === memberId),
  };
}

export function useSelfPrefs(gymId: string, memberId: string) {
  return useQuery({
    queryKey: selfKeys.prefs(gymId, memberId),
    queryFn: () => getSelfPrefs(gymId, memberId),
  });
}

export function useSetSelfWorkouts(gymId: string, memberId: string, trainerId: string) {
  const invalidate = useInvalidateSelf();
  return useMutation({
    mutationFn: (on: boolean) => setSelfWorkouts(gymId, memberId, trainerId, on),
    onSettled: invalidate,
  });
}

export function useCreateSelfPlan(gymId: string, memberId: string) {
  const invalidate = useInvalidateSelf();
  return useMutation({
    mutationFn: ({ prefs, plans }: { prefs: SelfPrefs; plans: SelfPlan[] }) =>
      createSelfPlan(gymId, memberId, prefs, plans),
    onSettled: invalidate,
  });
}

export function useSaveSelfWorkout() {
  const invalidate = useInvalidateSelf();
  return useMutation({ mutationFn: saveSelfWorkout, onSettled: invalidate });
}

export function useDeleteSelfWorkout() {
  const invalidate = useInvalidateSelf();
  return useMutation({ mutationFn: deleteSelfWorkout, onSettled: invalidate });
}
