import type {
  BranchAccess,
  Subscription,
  SubscriptionPayment,
} from '@/features/subscription/types';

/** Owners can pay for the next year once this many days or fewer are left. */
export const RENEW_WINDOW_DAYS = 30;

/**
 * Days an unpaid branch keeps working before the app locks for everyone there.
 * Adding people stops on the first unpaid day. branch_access() uses the same.
 */
export const GRACE_DAYS = 5;

/** Razorpay's payment page closes after this long (create-subscription-payment sets it). */
const LINK_MINUTES = 20;

/**
 * free: nothing to pay; unpaid: never paid; active: paid with time to spare;
 * dueSoon: inside the renewal window; expired: the paid year has ended.
 */
export type SubscriptionStatus = 'free' | 'unpaid' | 'active' | 'dueSoon' | 'expired';

function dayNumber(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

function isoDay(day: number) {
  return new Date(day * 86400000).toISOString().slice(0, 10);
}

/**
 * The year the next payment buys, as the server works it out: from the day after
 * the paid year ends, or from today once it has lapsed.
 */
export function nextPeriod(sub: Pick<Subscription, 'paidUntil' | 'today'>) {
  const today = dayNumber(sub.today);
  const start = sub.paidUntil ? Math.max(today, dayNumber(sub.paidUntil) + 1) : today;
  const [y, m, d] = isoDay(start).split('-').map(Number);
  return { start: isoDay(start), end: isoDay(Date.UTC(y + 1, m - 1, d) / 86400000 - 1) };
}

/** Days from today to the last paid day: 0 on the last day, negative once it has passed. */
export function daysLeft(sub: Pick<Subscription, 'paidUntil' | 'today'>) {
  return sub.paidUntil ? dayNumber(sub.paidUntil) - dayNumber(sub.today) : null;
}

export function subscriptionStatus(
  sub: Pick<Subscription, 'paidUntil' | 'today' | 'amountCents'>,
): SubscriptionStatus {
  const left = daysLeft(sub);
  if (left !== null && left >= 0) return left > RENEW_WINDOW_DAYS ? 'active' : 'dueSoon';
  if (sub.amountCents < 100) return 'free';
  return left === null ? 'unpaid' : 'expired';
}

/** Whether the owner can pay now; the server checks the same. */
export function canPay(sub: Subscription) {
  const status = subscriptionStatus(sub);
  return sub.amountCents >= 100 && status !== 'active' && status !== 'free';
}

/** A payment page that's still open and might yet be paid. */
export function isPending(payment: SubscriptionPayment, now: Date = new Date()) {
  if (payment.status !== 'created') return false;
  return now.getTime() - new Date(payment.createdAt).getTime() <= LINK_MINUTES * 60 * 1000;
}

/** The payments worth listing: paid years, newest first. */
export function paidYears(payments: SubscriptionPayment[]) {
  return payments.filter((p) => p.status === 'paid');
}

/**
 * As branch_access() works it out: unpaid branches lock GRACE_DAYS after the paid
 * year ended, or after the day a never-paid branch was set up (`startedOn`).
 */
export function branchAccess(
  sub: Pick<Subscription, 'paidUntil' | 'today' | 'amountCents'>,
  startedOn: string,
): BranchAccess {
  const status = subscriptionStatus(sub);
  if (status !== 'unpaid' && status !== 'expired') {
    return { paid: true, locksOn: null, locked: false };
  }
  const from = sub.paidUntil ? dayNumber(sub.paidUntil) + 1 : dayNumber(startedOn);
  const locksOn = isoDay(from + GRACE_DAYS);
  return { paid: false, locksOn, locked: sub.today >= locksOn };
}
