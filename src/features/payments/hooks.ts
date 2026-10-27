import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { membershipKeys } from '@/features/memberships/hooks';
import {
  fetchOnlinePayment,
  fetchOnlinePaymentsEnabled,
  listOnlinePayments,
  startOnlinePayment,
} from '@/features/payments/api';

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

/** One payment. Keeps checking every few seconds until Razorpay confirms or it expires. */
export function useOnlinePayment(paymentId: string) {
  return useQuery({
    queryKey: paymentKeys.one(paymentId),
    queryFn: () => fetchOnlinePayment(paymentId),
    refetchInterval: (query) => (query.state.data?.status === 'created' ? 3000 : false),
  });
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
export function usePayOnline(gymId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (planId: string) => {
      const { paymentId, url } = await startOnlinePayment(gymId, planId);
      await openPaymentPage(url);
      return paymentId;
    },
    onSuccess: (paymentId) =>
      router.push({ pathname: '/payment/[paymentId]', params: { paymentId } }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.all });
      queryClient.invalidateQueries({ queryKey: membershipKeys.all });
    },
  });
}
