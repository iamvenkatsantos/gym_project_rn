import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { selectActiveGym, selectInAdmin, useAuthStore } from '@/features/auth/auth-store';
import { branchKeys } from '@/features/branches/hooks';
import { openPaymentPage } from '@/features/payments/hooks';
import {
  fetchBranchAccess,
  fetchSubscription,
  fetchSubscriptionPayment,
  listSubscriptionPayments,
  recordSubscription,
  startSubscriptionPayment,
} from '@/features/subscription/api';
import { isPending } from '@/features/subscription/rules';

export const subscriptionKeys = {
  all: ['subscription'] as const,
  one: (gymId: string) => [...subscriptionKeys.all, gymId] as const,
  payments: (gymId: string) => [...subscriptionKeys.all, gymId, 'payments'] as const,
  payment: (id: string) => [...subscriptionKeys.all, 'payment', id] as const,
  access: (gymId: string) => [...subscriptionKeys.one(gymId), 'access'] as const,
};

/** Whether the branch's plan is paid, for anyone there. Off without a gym. */
export function useBranchAccess(gymId: string | undefined) {
  return useQuery({
    queryKey: subscriptionKeys.access(gymId ?? ''),
    queryFn: () => fetchBranchAccess(gymId!),
    enabled: !!gymId,
    // Checked again now and then, so a lock or an unlock shows without a restart.
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Whether the app is locked at the active gym because its plan wasn't paid in time.
 * Never in the admin area. The root layout and the index redirect both use it.
 */
export function useActiveBranchLocked() {
  const gymId = useAuthStore((s) => (selectInAdmin(s) ? undefined : selectActiveGym(s)?.gymId));
  return useBranchAccess(gymId).data?.locked === true;
}

/** What the branch pays CoreFit Gym. Owners and the admin only; off for everyone else. */
export function useSubscription(gymId: string, { enabled = true } = {}) {
  return useQuery({
    queryKey: subscriptionKeys.one(gymId),
    queryFn: () => fetchSubscription(gymId),
    enabled,
  });
}

export function useSubscriptionPayments(gymId: string) {
  return useQuery({
    queryKey: subscriptionKeys.payments(gymId),
    queryFn: () => listSubscriptionPayments(gymId),
  });
}

/**
 * The payment the owner just made. Keeps checking every few seconds until
 * Razorpay confirms it or its page closes, then refreshes the plan.
 */
export function useSubscriptionPayment(id: string | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: subscriptionKeys.payment(id ?? ''),
    queryFn: async () => {
      const payment = await fetchSubscriptionPayment(id!);
      if (payment?.status === 'paid') {
        queryClient.invalidateQueries({ queryKey: subscriptionKeys.one(payment.gymId) });
      }
      return payment;
    },
    enabled: !!id,
    refetchInterval: (q) => (q.state.data && isPending(q.state.data) ? 3000 : false),
  });
}

/** Opens Razorpay's page for the next year and resolves with the payment's id once the owner is back. */
export function usePaySubscription(gymId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { paymentId, url } = await startSubscriptionPayment(gymId);
      await openPaymentPage(url);
      return paymentId;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: subscriptionKeys.one(gymId) }),
  });
}

/** Admins only: a year paid by cash or bank transfer, or a free year (0). */
export function useRecordSubscription(gymId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ amountCents, note }: { amountCents: number; note: string }) =>
      recordSubscription(gymId, amountCents, note),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.one(gymId) });
      queryClient.invalidateQueries({ queryKey: branchKeys.all });
    },
  });
}
