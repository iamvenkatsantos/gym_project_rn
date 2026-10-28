import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  importMembers,
  invitePerson,
  sendImportInvites,
  listCoachedMembers,
  listGymMembers,
  listInvites,
  listPeople,
  removePerson,
  updatePerson,
  withdrawInvite,
} from '@/features/members/api';
import type { ImportRow } from '@/features/members/import-rules';
import type { MemberKind } from '@/features/members/rules';
import type { GymPerson, InviteRole } from '@/features/members/types';

export const memberKeys = {
  all: ['members'] as const,
  list: (gymId: string, kind: MemberKind) => [...memberKeys.all, gymId, kind] as const,
  people: (gymId: string) => [...memberKeys.all, gymId, 'people'] as const,
  invites: (gymId: string) => [...memberKeys.all, gymId, 'invites'] as const,
  coached: (gymId: string, trainerId: string) =>
    [...memberKeys.all, gymId, 'coached', trainerId] as const,
};

export function useGymMembers(gymId: string, kind: MemberKind = 'member') {
  return useQuery({
    queryKey: memberKeys.list(gymId, kind),
    queryFn: () => listGymMembers(gymId, kind),
  });
}

/** Everyone at the gym; pass enabled: false for roles that can't list people. */
export function usePeople(gymId: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: memberKeys.people(gymId),
    queryFn: () => listPeople(gymId),
    enabled,
  });
}

export function useInvites(gymId: string) {
  return useQuery({ queryKey: memberKeys.invites(gymId), queryFn: () => listInvites(gymId) });
}

export function useCoachedMembers(gymId: string, trainerId: string) {
  return useQuery({
    queryKey: memberKeys.coached(gymId, trainerId),
    queryFn: () => listCoachedMembers(gymId, trainerId),
  });
}

function useInvalidateMembers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: memberKeys.all });
}

export function useInvitePerson(gymId: string) {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: InviteRole }) =>
      invitePerson(gymId, email, role),
    onSettled: invalidate,
  });
}

/** Imports checked rows from the owner's file; onProgress gets how many rows are done. */
export function useImportMembers(gymId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      rows,
      onProgress,
    }: {
      rows: ImportRow[];
      onProgress?: (done: number) => void;
    }) => importMembers(gymId, rows, onProgress),
    // People, and the memberships behind renewals and the dashboard.
    onSettled: () => queryClient.invalidateQueries(),
  });
}

/** Emails the imported members who have no account yet their invites. */
export function useSendImportInvites(gymId: string) {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: ({
      emails,
      onProgress,
    }: {
      emails: string[];
      onProgress?: (done: number) => void;
    }) => sendImportInvites(gymId, emails, onProgress),
    onSettled: invalidate,
  });
}

export function useWithdrawInvite() {
  const invalidate = useInvalidateMembers();
  return useMutation({ mutationFn: withdrawInvite, onSettled: invalidate });
}

export function useUpdatePerson(gymId: string) {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: ({ userId, patch }: { userId: string; patch: Pick<GymPerson, 'status'> }) =>
      updatePerson(gymId, userId, patch),
    onSettled: invalidate,
  });
}

export function useRemovePerson(gymId: string) {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: (userId: string) => removePerson(gymId, userId),
    onSettled: invalidate,
  });
}
