import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  cancelPermission,
  decidePermission,
  getTrainerHourRules,
  getTrainerHoursMonth,
  listPermissions,
  requestPermission,
  saveTrainerHourRules,
} from '@/features/trainer-hours/api';
import type { PermissionInput, TrainerHourRulesInput } from '@/features/trainer-hours/types';

export const trainerHourKeys = {
  all: ['trainer-hours'] as const,
  rules: (gymId: string) => [...trainerHourKeys.all, gymId, 'rules'] as const,
  month: (gymId: string, month: string) => [...trainerHourKeys.all, gymId, 'month', month] as const,
  permissions: (gymId: string, trainerId?: string) =>
    [...trainerHourKeys.all, gymId, 'permissions', trainerId ?? 'all'] as const,
};

/** Owners only: trainers can't read the rules. */
export function useTrainerHourRules(gymId: string, enabled = true) {
  return useQuery({
    queryKey: trainerHourKeys.rules(gymId),
    queryFn: () => getTrainerHourRules(gymId),
    enabled,
  });
}

export function useSaveTrainerHourRules(gymId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rules: TrainerHourRulesInput) => saveTrainerHourRules(gymId, rules),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trainerHourKeys.all }),
  });
}

export function useTrainerHoursMonth(gymId: string, month: string, enabled = true) {
  return useQuery({
    queryKey: trainerHourKeys.month(gymId, month),
    queryFn: () => getTrainerHoursMonth(gymId, month),
    enabled,
  });
}

/** Every trainer's requests for owners; pass trainerId for a trainer's own. */
export function usePermissions(gymId: string, trainerId?: string, enabled = true) {
  return useQuery({
    queryKey: trainerHourKeys.permissions(gymId, trainerId),
    queryFn: () => listPermissions(gymId, trainerId),
    enabled,
  });
}

export function useRequestPermission(gymId: string, trainer: { id: string; fullName: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PermissionInput) => requestPermission(gymId, trainer, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trainerHourKeys.all }),
  });
}

export function useCancelPermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelPermission(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: trainerHourKeys.all }),
  });
}

export function useDecidePermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      decidePermission(id, approve),
    onSettled: () => queryClient.invalidateQueries({ queryKey: trainerHourKeys.all }),
  });
}
