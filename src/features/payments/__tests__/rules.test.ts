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
    currency: 'INR',
    status,
    linkUrl: 'https://rzp.io/i/x',
    razorpayPaymentId: null,
    membershipId: null,
    startsOn: null,
    endsOn: null,
    feeCents: null,
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
  it("takes off Razorpay's fee once it's known", () => {
    expect(netAmount({ amountCents: 150000, feeCents: 3540 })).toBe(146460);
    expect(netAmount({ amountCents: 150000, feeCents: null })).toBeNull();
  });
});
