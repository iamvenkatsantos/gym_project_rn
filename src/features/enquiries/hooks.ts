import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createEnquiry,
  deleteEnquiry,
  listEnquiries,
  listEnquiryNotes,
  logFollowUp,
  mockLinkEnquiry,
  updateEnquiry,
} from '@/features/enquiries/api';
import type { EnquiryInput, EnquiryPatch, FollowUpKind } from '@/features/enquiries/types';
import { invitePerson } from '@/features/members/api';
import { memberKeys } from '@/features/members/hooks';
import { supabase } from '@/lib/supabase';

export const enquiryKeys = {
  all: ['enquiries'] as const,
  list: (gymId: string) => [...enquiryKeys.all, gymId] as const,
  notes: (enquiryId: string) => [...enquiryKeys.all, 'notes', enquiryId] as const,
};

/** Every enquiry at the gym; pass enabled: false for roles that can't see them. */
export function useEnquiries(gymId: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: enquiryKeys.list(gymId),
    queryFn: () => listEnquiries(gymId),
    enabled,
  });
}

export function useEnquiryNotes(enquiryId: string) {
  return useQuery({
    queryKey: enquiryKeys.notes(enquiryId),
    queryFn: () => listEnquiryNotes(enquiryId),
  });
}

function useInvalidateEnquiries() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: enquiryKeys.all });
}

export function useCreateEnquiry(gymId: string) {
  const invalidate = useInvalidateEnquiries();
  return useMutation({
    mutationFn: (input: EnquiryInput) => createEnquiry(gymId, input),
    onSuccess: invalidate,
  });
}

export function useUpdateEnquiry() {
  const invalidate = useInvalidateEnquiries();
  return useMutation({
    mutationFn: ({ enquiryId, patch }: { enquiryId: string; patch: EnquiryPatch }) =>
      updateEnquiry(enquiryId, patch),
    onSettled: invalidate,
  });
}

export function useDeleteEnquiry() {
  const invalidate = useInvalidateEnquiries();
  return useMutation({ mutationFn: deleteEnquiry, onSuccess: invalidate });
}

export function useLogFollowUp(enquiryId: string) {
  const invalidate = useInvalidateEnquiries();
  return useMutation({
    mutationFn: ({
      kind,
      body,
      nextAt,
    }: {
      kind: FollowUpKind;
      body: string;
      nextAt: string | null;
    }) => logFollowUp(enquiryId, kind, body, nextAt),
    onSuccess: invalidate,
  });
}

/**
 * Invites the enquiry as a member and marks it joined. The email is saved first,
 * so the server links the enquiry to their account the moment they join.
 */
export function useConvertEnquiry(gymId: string, enquiryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      await updateEnquiry(enquiryId, { email });
      const outcome = await invitePerson(gymId, email, 'member');
      if (!supabase && outcome.result !== 'invited') mockLinkEnquiry(enquiryId, email);
      await updateEnquiry(enquiryId, { status: 'joined' });
      return outcome;
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: enquiryKeys.all }),
        queryClient.invalidateQueries({ queryKey: memberKeys.all }),
      ]),
  });
}
