import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchMemberRules, saveMemberRules } from '@/features/member-rules/api';
import type { MemberRules } from '@/features/member-rules/types';

export const memberRuleKeys = {
  rules: (gymId: string) => ['member-rules', gymId] as const,
};

export function useMemberRules(gymId: string) {
  return useQuery({
    queryKey: memberRuleKeys.rules(gymId),
    queryFn: () => fetchMemberRules(gymId),
  });
}

export function useSaveMemberRules(gymId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rules: MemberRules) => saveMemberRules(gymId, rules),
    onSettled: () => queryClient.invalidateQueries({ queryKey: memberRuleKeys.rules(gymId) }),
  });
}
