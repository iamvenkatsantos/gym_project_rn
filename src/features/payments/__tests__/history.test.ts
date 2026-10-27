import type { Membership } from '@/features/memberships/types';
import { memberHistory, paymentsByMember, searchMembers } from '@/features/payments/history';
import type { OnlinePayment } from '@/features/payments/types';

const now = new Date('2026-10-27T12:00:00Z');
const plan = { id: 'p1', name: 'Monthly', priceCents: 150000, currency: 'INR', durationDays: 30 };

function membership(
  id: string,
  memberId: string,
  recordedAt: string | undefined,
  amountPaidCents: number | null = 150000,
): Membership {
  return {
    id,
    memberId,
    memberName: memberId === 'meena' ? 'Meena' : 'Ravi',
    plan,
    startsOn: '2026-10-01',
    endsOn: '2026-10-30',
    amountPaidCents,
    paymentMethod: 'cash',
    recordedAt,
  };
}

function online(
  id: string,
  memberId: string,
  status: OnlinePayment['status'],
  createdAt: string,
  membershipId: string | null = null,
): OnlinePayment {
  return {
    id,
    gymId: 'g1',
    memberId,
    memberName: memberId === 'meena' ? 'Meena' : 'Ravi',
    planId: 'p1',
    planName: 'Monthly',
    amountCents: 150000,
    currency: 'INR',
    status,
    linkUrl: null,
    razorpayPaymentId: null,
    membershipId,
    startsOn: null,
    endsOn: null,
    feeCents: null,
    transferError: null,
    createdAt,
    paidAt: null,
  };
}

describe('memberHistory', () => {
  const memberships = [
    membership('m-old', 'meena', '2026-08-01T10:00:00Z'),
    membership('m-new', 'meena', '2026-10-01T10:00:00Z'),
    membership('m-ravi', 'ravi', '2026-10-05T10:00:00Z'),
  ];
  const payments = [
    online('o-paid', 'meena', 'paid', '2026-10-01T09:59:00Z', 'm-new'),
    online('o-open', 'meena', 'created', '2026-10-27T11:55:00Z'),
    online('o-left', 'meena', 'created', '2026-10-26T09:00:00Z'),
  ];

  it('lists only that member, a payment in progress first, then newest', () => {
    expect(memberHistory('meena', memberships, payments, now).map((e) => e.id)).toEqual([
      'o-open',
      'm-new',
      'm-old',
    ]);
  });

  it('links in-app payments to their receipt', () => {
    const entries = memberHistory('meena', memberships, payments, now);
    const linked = entries.map((e) => (e.kind === 'recorded' ? e.onlinePaymentId : 'pending'));
    expect(linked).toEqual(['pending', 'o-paid', null]);
  });

  it('dates demo payments by their start day', () => {
    const [entry] = memberHistory('ravi', [membership('m', 'ravi', undefined)], [], now);
    expect(entry.kind === 'recorded' && entry.paidAt).toBe('2026-10-01T00:00:00');
  });
});

describe('paymentsByMember', () => {
  it('totals each member, someone paying now first, then most recent', () => {
    const list = paymentsByMember(
      [
        membership('a', 'meena', '2026-08-01T10:00:00Z'),
        membership('b', 'meena', '2026-09-01T10:00:00Z', null),
        membership('c', 'ravi', '2026-10-05T10:00:00Z'),
      ],
      [online('o', 'meena', 'created', '2026-10-27T11:58:00Z')],
      now,
    );
    expect(list.map((m) => [m.memberName, m.payments, m.totalCents, m.pending])).toEqual([
      ['Meena', 2, 150000, 1],
      ['Ravi', 1, 150000, 0],
    ]);
    expect(list[0].lastPaidAt).toBe('2026-09-01T10:00:00Z');
  });

  it('finds members by part of their name', () => {
    const list = paymentsByMember([membership('a', 'meena', undefined)], [], now);
    expect(searchMembers(list, '  MEE ').map((m) => m.memberName)).toEqual(['Meena']);
    expect(searchMembers(list, 'zz')).toEqual([]);
  });
});
