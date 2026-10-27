import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';

import { membershipKeys } from '@/features/memberships/hooks';
import {
  fetchOnlinePayment,
  fetchOnlinePaymentsEnabled,
  listOnlinePayments,
  startOnlinePayment,
} from '@/features/payments/api';
import { paymentState } from '@/features/payments/rules';

/** razorpay-webhook sends the browser here when the member leaves Razorpay's page. */
export const PAYMENT_RETURN_URL = 'corefit://payment-return';

export const paymentKeys = {
  all: ['online-payments'] as const,
  enabled: (gymId: string) => [...paymentKeys.all, gymId, 'enabled'] as const,
  list: (gymId: string, memberId?: string) =>
    [...paymentKeys.all, gymId, 'list', memberId ?? 'all'] as const,
  one: (paymentId: string) => [...paymentKeys.all, 'one', paymentId] as const,
};

export function useOnlinePaymentsEnabled(gymId: string) {
  return useQuery({
    queryKey: paymentKeys.enabled(gymId),
    queryFn: () => fetchOnlinePaymentsEnabled(gymId),
  });
}

/**
 * One payment. Keeps checking every few seconds while Razorpay's page is open, and
 * once it's paid refreshes the membership and payment lists that show it.
 */
export function useOnlinePayment(paymentId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: paymentKeys.one(paymentId),
    queryFn: () => fetchOnlinePayment(paymentId),
    refetchInterval: (q) =>
      q.state.data && paymentState(q.state.data) === 'pending' ? 3000 : false,
  });
  const paid = query.data?.status === 'paid';
  useEffect(() => {
    if (!paid) return;
    queryClient.invalidateQueries({ queryKey: membershipKeys.all });
    // Every list, but not this payment itself, which just loaded.
    queryClient.invalidateQueries({
      queryKey: paymentKeys.all,
      predicate: (q) => q.queryKey[1] !== 'one',
    });
  }, [paid, queryClient]);
  return query;
}

export function useOnlinePayments(gymId: string, memberId?: string) {
  return useQuery({
    queryKey: paymentKeys.list(gymId, memberId),
    queryFn: () => listOnlinePayments(gymId, memberId),
  });
}

/** Opens Razorpay's payment page in the app's browser and waits for the member to come back. */
export async function openPaymentPage(url: string) {
  await WebBrowser.openAuthSessionAsync(url, PAYMENT_RETURN_URL);
}

/**
 * Pays for a plan: opens Razorpay's page, then shows the payment's status, which
 * turns into a receipt once Razorpay confirms it.
 */
export function usePayOnline(gymId: string, { replace = false } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (planId: string) => {
      const { paymentId, url } = await startOnlinePayment(gymId, planId);
      await openPaymentPage(url);
      return paymentId;
    },
    // A retry from a payment's own screen takes its place rather than stacking on it.
    onSuccess: (paymentId) =>
      (replace ? router.replace : router.push)({
        pathname: '/payment/[paymentId]',
        params: { paymentId },
      }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.all });
      queryClient.invalidateQueries({ queryKey: membershipKeys.all });
    },
  });
}
