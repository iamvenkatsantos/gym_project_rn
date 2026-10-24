import { useQuery } from '@tanstack/react-query';

import { listGymMembers } from '@/features/members/api';

export const memberKeys = {
  all: ['members'] as const,
  list: (gymId: string) => [...memberKeys.all, gymId] as const,
};

export function useGymMembers(gymId: string) {
  return useQuery({ queryKey: memberKeys.list(gymId), queryFn: () => listGymMembers(gymId) });
}
