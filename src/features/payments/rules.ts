import type { OnlinePayment } from '@/features/payments/types';

/** Razorpay's payment page closes after this long (create-payment sets it). */
export const LINK_MINUTES = 20;

export type PaymentState = 'paid' | 'pending' | 'notCompleted';

/**
 * Paid, still open on Razorpay's page, or not completed: the page expired or was
 * left long enough that it can't be paid any more.
 */
export function paymentState(payment: OnlinePayment, now: Date = new Date()): PaymentState {
  if (payment.status === 'paid') return 'paid';
  if (payment.status === 'expired') return 'notCompleted';
  const age = now.getTime() - new Date(payment.createdAt).getTime();
  return age > LINK_MINUTES * 60 * 1000 ? 'notCompleted' : 'pending';
}

/** What the gym receives once Razorpay's fee is taken, if the fee is known yet. */
export function netAmount(payment: Pick<OnlinePayment, 'amountCents' | 'feeCents'>) {
  return payment.feeCents == null ? null : payment.amountCents - payment.feeCents;
}
