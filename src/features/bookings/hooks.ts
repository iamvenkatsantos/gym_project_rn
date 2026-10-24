import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  bookClass,
  cancelBooking,
  listMyBookings,
  listUpcomingClasses,
} from '@/features/bookings/api';

export const bookingKeys = {
  all: ['bookings'] as const,
  classes: (trainerId?: string) => [...bookingKeys.all, 'classes', { trainerId }] as const,
  mine: (memberId: string) => [...bookingKeys.all, 'mine', memberId] as const,
};

export function useUpcomingClasses(trainerId?: string) {
  return useQuery({
    queryKey: bookingKeys.classes(trainerId),
    queryFn: () => listUpcomingClasses({ trainerId }),
  });
}

export function useMyBookings(memberId: string) {
  return useQuery({
    queryKey: bookingKeys.mine(memberId),
    queryFn: () => listMyBookings(memberId),
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
