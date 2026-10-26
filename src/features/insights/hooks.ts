import { useQuery } from '@tanstack/react-query';

import { getBusiestHours, getMemberInsights, getRevenueByMonth } from '@/features/insights/api';

export const insightsKeys = {
  all: ['insights'] as const,
  revenue: (gymId: string, months: number) =>
    [...insightsKeys.all, gymId, 'revenue', months] as const,
  members: (gymId: string) => [...insightsKeys.all, gymId, 'members'] as const,
  hours: (gymId: string, days: number) => [...insightsKeys.all, gymId, 'hours', days] as const,
};

export function useRevenueByMonth(gymId: string, months: number) {
  return useQuery({
    queryKey: insightsKeys.revenue(gymId, months),
    queryFn: () => getRevenueByMonth(gymId, months),
  });
}

export function useMemberInsights(gymId: string) {
  return useQuery({
    queryKey: insightsKeys.members(gymId),
    queryFn: () => getMemberInsights(gymId),
  });
}

export function useBusiestHours(gymId: string, days: number) {
  return useQuery({
    queryKey: insightsKeys.hours(gymId, days),
    queryFn: () => getBusiestHours(gymId, days),
  });
}
