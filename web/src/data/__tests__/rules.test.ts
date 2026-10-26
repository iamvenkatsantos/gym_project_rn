import { describe, expect, it } from 'vitest';

import type { GymPerson, Membership, PaymentRow } from '../types';
import {
  daysAgo,
  lastMonthToDate,
  matchesSearch,
  memberRows,
  standingCounts,
  summarizePayments,
} from '../rules';

const today = new Date(2026, 9, 26);

const person = (id: string, over: Partial<GymPerson> = {}): GymPerson => ({
  id,
  fullName: `Person ${id}`,
  email: `${id}@example.com`,
  role: 'member',
  status: 'active',
  joinedAt: '2026-01-01T00:00:00Z',
  ...over,
});

const membership = (memberId: string, startsOn: string, endsOn: string): Membership => ({
  id: `${memberId}-${endsOn}`,
  memberId,
  memberName: `Person ${memberId}`,
  plan: { id: 'p', name: 'Monthly', priceCents: 150000, currency: 'INR', durationDays: 30 },
  startsOn,
  endsOn,
  amountPaidCents: 150000,
  paymentMethod: 'upi',
});

const payment = (cents: number | null, method: PaymentRow['paymentMethod']): PaymentRow => ({
  paidOn: '2026-10-01',
  memberName: 'A',
  memberEmail: null,
  planName: 'Monthly',
  amountPaidCents: cents,
  currency: 'INR',
  paymentMethod: method,
  startsOn: '2026-10-01',
  endsOn: '2026-10-30',
  recordedBy: 'Owner',
  note: '',
});

describe('memberRows', () => {
  it('leaves out staff and uses each member’s latest membership', () => {
    const rows = memberRows(
      [person('a'), person('b'), person('t', { role: 'trainer' })],
      [
        membership('a', '2026-08-01', '2026-08-30'),
        membership('a', '2026-10-01', '2026-10-30'),
        membership('b', '2026-09-01', '2026-09-30'),
      ],
      today,
    );
    expect(rows.map((r) => [r.id, r.standing])).toEqual([
      ['a', 'expiringSoon'],
      ['b', 'expired'],
    ]);
  });

  it('marks members who never paid', () => {
    expect(memberRows([person('a')], [], today)[0].standing).toBe('none');
  });
});

describe('standingCounts', () => {
  it('counts active members only', () => {
    const rows = memberRows(
      [person('a'), person('b', { status: 'suspended' }), person('c')],
      [membership('a', '2026-10-01', '2026-12-31'), membership('b', '2026-10-01', '2026-12-31')],
      today,
    );
    expect(standingCounts(rows)).toEqual({
      active: 1,
      expiringSoon: 0,
      expired: 0,
      upcoming: 0,
      none: 1,
    });
  });
});

describe('summarizePayments', () => {
  it('totals by method, biggest first', () => {
    const summary = summarizePayments([
      payment(100000, 'cash'),
      payment(150000, 'upi'),
      payment(150000, 'upi'),
      payment(null, null),
    ]);
    expect(summary.totalCents).toBe(400000);
    expect(summary.count).toBe(4);
    expect(summary.byMethod).toEqual([
      { label: 'UPI', cents: 300000, count: 2 },
      { label: 'Cash', cents: 100000, count: 1 },
      { label: 'Not recorded', cents: 0, count: 1 },
    ]);
  });

  it('defaults to rupees with no payments', () => {
    expect(summarizePayments([])).toEqual({
      totalCents: 0,
      count: 0,
      currency: 'INR',
      byMethod: [],
    });
  });
});

describe('dates', () => {
  it('counts days back to today', () => {
    expect(daysAgo('2026-10-26', today)).toBe(0);
    expect(daysAgo('2026-10-01', today)).toBe(25);
    expect(daysAgo('2026-11-01', today)).toBe(0);
  });

  it('compares against the same span last month, clamped to its last day', () => {
    expect(lastMonthToDate(today)).toEqual({ from: '2026-09-01', to: '2026-09-26' });
    expect(lastMonthToDate(new Date(2026, 2, 31))).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
  });
});

describe('matchesSearch', () => {
  it('matches name or email, ignoring case', () => {
    const row = { fullName: 'Priya Kumar', email: 'priya@example.com' };
    expect(matchesSearch(row, 'KUMAR')).toBe(true);
    expect(matchesSearch(row, 'priya@')).toBe(true);
    expect(matchesSearch(row, 'ravi')).toBe(false);
    expect(matchesSearch(row, '  ')).toBe(true);
  });
});
