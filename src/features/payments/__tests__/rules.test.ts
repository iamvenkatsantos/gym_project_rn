import { netAmount, paymentState } from '@/features/payments/rules';
import type { OnlinePayment } from '@/features/payments/types';

const now = new Date('2026-10-27T12:00:00Z');

function payment(id: string, status: OnlinePayment['status'], createdAt: string): OnlinePayment {
  return {
    id,
    gymId: 'g1',
    memberId: 'm1',
    memberName: 'Meena',
    planId: 'p1',
    planName: 'Monthly',
    amountCents: 150000,
    baseCents: 150000,
    chargesCents: 0,
    currency: 'INR',
    status,
    linkUrl: 'https://rzp.io/i/x',
    razorpayPaymentId: null,
    membershipId: null,
    startsOn: null,
    endsOn: null,
    feeCents: null,
    cutCents: 0,
    transferCents: null,
    transferError: null,
    createdAt,
    paidAt: null,
  };
}

describe('paymentState', () => {
  it('is pending while the payment page is still open', () => {
    expect(paymentState(payment('a', 'created', '2026-10-27T11:50:00Z'), now)).toBe('pending');
  });

  it('is not completed once the page has expired, even before the webhook says so', () => {
    expect(paymentState(payment('a', 'created', '2026-10-27T11:30:00Z'), now)).toBe('notCompleted');
    expect(paymentState(payment('a', 'expired', '2026-10-27T11:59:00Z'), now)).toBe('notCompleted');
  });

  it('is paid once confirmed', () => {
    expect(paymentState(payment('a', 'paid', '2026-10-27T09:00:00Z'), now)).toBe('paid');
  });
});

describe('netAmount', () => {
  const base = { amountCents: 150000, cutCents: 0, transferCents: null };

  it("takes off Razorpay's gateway and transfer fees once the gateway fee is known", () => {
    // 146460 left after the gateway fee; the transfer leaves 432 for its own fee.
    expect(netAmount({ ...base, feeCents: 3540 })).toBe(146028);
    expect(netAmount({ ...base, feeCents: null })).toBeNull();
  });

  it('takes off the cut too', () => {
    expect(netAmount({ ...base, feeCents: 3540, cutCents: 1500 })).toBeLessThan(146028 - 1490);
  });

  it('is what was transferred, once it was', () => {
    expect(netAmount({ ...base, feeCents: 3540, transferCents: 146000 })).toBe(146000);
  });
});
