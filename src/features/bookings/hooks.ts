import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  bookClass,
  cancelBooking,
  listMyBookings,
  listUpcomingClasses,
} from '@/features/bookings/api';

export const bookingKeys = {
  all: ['bookings'] as const,
  classes: (gymId: string, trainerId?: string) =>
    [...bookingKeys.all, gymId, 'classes', { trainerId }] as const,
  mine: (gymId: string, memberId: string) => [...bookingKeys.all, gymId, 'mine', memberId] as const,
};

export function useUpcomingClasses(gymId: string, trainerId?: string) {
  return useQuery({
    queryKey: bookingKeys.classes(gymId, trainerId),
    queryFn: () => listUpcomingClasses(gymId, { trainerId }),
  });
}

export function useMyBookings(gymId: string, memberId: string) {
  return useQuery({
    queryKey: bookingKeys.mine(gymId, memberId),
    queryFn: () => listMyBookings(gymId, memberId),
  });
}

export function useBookClass(memberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (classId: string) => bookClass(classId, memberId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: bookingKeys.all }),
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelBooking,
    onSettled: () => queryClient.invalidateQueries({ queryKey: bookingKeys.all }),
  });
}
