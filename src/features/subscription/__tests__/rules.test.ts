import {
  branchAccess,
  canPay,
  daysLeft,
  isPending,
  nextPeriod,
  paidYears,
  subscriptionStatus,
} from '@/features/subscription/rules';
import type { Subscription, SubscriptionPayment } from '@/features/subscription/types';

const today = '2026-10-29';

function sub(paidUntil: string | null, amountCents = 499900): Subscription {
  return { feeCents: amountCents, addonCents: 0, amountCents, currency: 'INR', paidUntil, today };
}

function payment(status: SubscriptionPayment['status'], createdAt: string): SubscriptionPayment {
  return {
    id: createdAt,
    gymId: 'g1',
    method: 'online',
    amountCents: 499900,
    currency: 'INR',
    status,
    periodStart: null,
    periodEnd: null,
    note: null,
    createdAt,
    paidAt: null,
  };
}

describe('subscriptionStatus', () => {
  it('is unpaid until the first payment', () => {
    expect(subscriptionStatus(sub(null))).toBe('unpaid');
    expect(canPay(sub(null))).toBe(true);
  });

  it('is active with more than 30 days left, and can not be paid yet', () => {
    expect(subscriptionStatus(sub('2026-11-29'))).toBe('active');
    expect(canPay(sub('2026-11-29'))).toBe(false);
  });

  it('is due soon inside the last 30 days, the last day included', () => {
    expect(subscriptionStatus(sub('2026-11-28'))).toBe('dueSoon');
    expect(subscriptionStatus(sub(today))).toBe('dueSoon');
    expect(daysLeft(sub(today))).toBe(0);
    expect(canPay(sub('2026-11-28'))).toBe(true);
  });

  it('has ended the day after the paid year', () => {
    expect(subscriptionStatus(sub('2026-10-28'))).toBe('expired');
    expect(daysLeft(sub('2026-10-28'))).toBe(-1);
  });

  it('is free when there is nothing to pay, unless a paid year still runs', () => {
    expect(subscriptionStatus(sub(null, 0))).toBe('free');
    expect(canPay(sub(null, 0))).toBe(false);
    expect(subscriptionStatus(sub('2027-06-01', 0))).toBe('active');
  });
});

describe('nextPeriod', () => {
  it('starts today when never paid or lapsed, and runs a year', () => {
    expect(nextPeriod(sub(null))).toEqual({ start: today, end: '2027-10-28' });
    expect(nextPeriod(sub('2026-01-01'))).toEqual({ start: today, end: '2027-10-28' });
  });

  it('runs on from the day after the paid year', () => {
    expect(nextPeriod(sub('2026-11-10'))).toEqual({ start: '2026-11-11', end: '2027-11-10' });
  });

  it('handles a leap day', () => {
    expect(nextPeriod({ paidUntil: '2028-02-28', today: '2028-02-01' })).toEqual({
      start: '2028-02-29',
      end: '2029-02-28',
    });
  });
});

describe('payments', () => {
  const now = new Date('2026-10-29T10:00:00Z');

  it('is pending while the payment page is open', () => {
    expect(isPending(payment('created', '2026-10-29T09:50:00Z'), now)).toBe(true);
    expect(isPending(payment('created', '2026-10-29T09:30:00Z'), now)).toBe(false);
    expect(isPending(payment('paid', '2026-10-29T09:59:00Z'), now)).toBe(false);
  });

  it('lists only paid years', () => {
    const list = [payment('expired', 'a'), payment('paid', 'b'), payment('created', 'c')];
    expect(paidYears(list).map((p) => p.id)).toEqual(['b']);
  });
});

describe('branchAccess', () => {
  it('is open while paid or free', () => {
    expect(branchAccess(sub('2026-11-10'), '2026-01-01')).toEqual({
      paid: true,
      locksOn: null,
      locked: false,
    });
    expect(branchAccess(sub(null, 0), '2026-01-01').locked).toBe(false);
  });

  it('locks 5 days after the paid year ends', () => {
    expect(branchAccess(sub('2026-10-26'), '2026-01-01')).toEqual({
      paid: false,
      locksOn: '2026-11-01',
      locked: false,
    });
    expect(branchAccess(sub('2026-10-23'), '2026-01-01')).toEqual({
      paid: false,
      locksOn: '2026-10-29',
      locked: true,
    });
  });

  it('counts a never-paid branch from the day it was set up', () => {
    expect(branchAccess(sub(null), '2026-10-27')).toMatchObject({
      locksOn: '2026-11-01',
      locked: false,
    });
    expect(branchAccess(sub(null), '2026-10-20').locked).toBe(true);
  });
});
