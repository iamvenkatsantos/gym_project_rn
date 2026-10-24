import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listNotifications, markAllRead, messageTrainer } from '@/features/notifications/api';
import { clearBadge } from '@/features/notifications/push';
import type { TrainerMessageInput } from '@/features/notifications/types';

export const notificationKeys = {
  all: ['notifications'] as const,
  inbox: (gymId: string, recipientId: string) =>
    [...notificationKeys.all, gymId, recipientId] as const,
};

export function useNotifications(gymId: string, recipientId: string) {
  return useQuery({
    queryKey: notificationKeys.inbox(gymId, recipientId),
    queryFn: () => listNotifications(gymId, recipientId),
  });
}

export function useMarkAllRead(gymId: string, recipientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllRead(gymId, recipientId),
    onSuccess: clearBadge,
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMessageTrainer(gymId: string, senderId: string) {
  return useMutation({
    mutationFn: (input: TrainerMessageInput) => messageTrainer(gymId, senderId, input),
  });
}
