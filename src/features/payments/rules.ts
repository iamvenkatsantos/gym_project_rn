import type { OnlinePayment, PaymentQuote } from '@/features/payments/types';
import { formatAmount } from '@/lib/format';

import { routeTransfer } from '../../../supabase/functions/_shared/fees';

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

/**
 * What the gym receives: the transfer to the owner's Razorpay account once it's
 * made, or until then what it will be after Razorpay's fees and CoreFit Gym's
 * cut. Null until Razorpay's fee is known.
 */
export function netAmount(
  payment: Pick<OnlinePayment, 'amountCents' | 'feeCents' | 'cutCents' | 'transferCents'>,
) {
  if (payment.transferCents != null) return payment.transferCents;
  if (payment.feeCents == null) return null;
  return routeTransfer(payment.amountCents - payment.feeCents - payment.cutCents)?.transfer ?? 0;
}

/** The message a member confirms before paying a plan with online charges on top. */
export function quoteMessage(quote: PaymentQuote) {
  const money = (cents: number) => formatAmount(cents, quote.currency);
  return [
    `Membership: ${money(quote.baseCents)}`,
    `Payment gateway fee + GST: ${money(quote.gatewayFeeCents)}`,
    `Transfer fee + GST: ${money(quote.transferFeeCents)}`,
    `Total: ${money(quote.amountCents)}`,
    '',
    'Razorpay charges these fees for paying online.',
  ].join('\n');
}
