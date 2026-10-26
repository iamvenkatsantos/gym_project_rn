import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Role } from '@/features/auth/types';
import {
  deleteAnnouncement,
  listAnnouncements,
  sendAnnouncement,
} from '@/features/announcements/api';
import type { AnnouncementInput } from '@/features/announcements/types';

export const announcementKeys = {
  all: ['announcements'] as const,
  list: (gymId: string, role: Role) => [...announcementKeys.all, gymId, role] as const,
};

export function useAnnouncements(gymId: string, role: Role) {
  return useQuery({
    queryKey: announcementKeys.list(gymId, role),
    queryFn: () => listAnnouncements(gymId, role),
  });
}

export function useSendAnnouncement(gymId: string, senderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AnnouncementInput) => sendAnnouncement(gymId, senderId, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: announcementKeys.all }),
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAnnouncement,
    onSettled: () => queryClient.invalidateQueries({ queryKey: announcementKeys.all }),
  });
}
