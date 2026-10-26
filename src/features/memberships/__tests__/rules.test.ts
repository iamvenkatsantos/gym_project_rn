import {
  daysRemaining,
  endDateFor,
  membershipStatus,
  parseRupees,
  remainingFraction,
  renewalStart,
  groupRenewals,
  renewalsDue,
  toIsoDate,
} from '@/features/memberships/rules';
import type { Membership } from '@/features/memberships/types';

const today = new Date(2026, 9, 24);

function membership(startsOn: string, endsOn: string): Membership {
  return {
    id: 'm-1',
    memberId: 'u-1',
    memberName: 'Maya',
    plan: { id: 'p-1', name: 'Monthly', priceCents: 4900, currency: 'USD', durationDays: 30 },
    startsOn,
    endsOn,
    amountPaidCents: null,
    paymentMethod: null,
  };
}

describe('daysRemaining', () => {
  it('counts today as a remaining day', () => {
    expect(daysRemaining(membership('2026-10-01', '2026-10-24'), today)).toBe(1);
    expect(daysRemaining(membership('2026-10-01', '2026-10-30'), today)).toBe(7);
  });

  it('is zero after the end date', () => {
    expect(daysRemaining(membership('2026-09-01', '2026-10-23'), today)).toBe(0);
  });
});

describe('membershipStatus', () => {
  it.each([
    ['2026-10-01', '2026-11-30', 'active'],
    ['2026-10-01', '2026-10-30', 'expiringSoon'],
    ['2026-09-01', '2026-10-23', 'expired'],
    ['2026-10-25', '2026-11-25', 'upcoming'],
  ] as const)('%s to %s is %s', (startsOn, endsOn, expected) => {
    expect(membershipStatus(membership(startsOn, endsOn), today)).toBe(expected);
  });
});

describe('remainingFraction', () => {
  it('is 1 on the first day and shrinks to 0 after the end', () => {
    expect(remainingFraction(membership('2026-10-24', '2026-11-22'), today)).toBe(1);
    expect(remainingFraction(membership('2026-09-25', '2026-10-24'), today)).toBeCloseTo(1 / 30);
    expect(remainingFraction(membership('2026-09-01', '2026-10-01'), today)).toBe(0);
  });
});

describe('renewalsDue', () => {
  it('lists expiring and expired memberships, soonest end first', () => {
    const list = [
      { ...membership('2026-10-01', '2026-11-30'), id: 'active', memberId: 'a' },
      { ...membership('2026-10-01', '2026-10-28'), id: 'soon', memberId: 'b' },
      { ...membership('2026-09-01', '2026-10-20'), id: 'expired', memberId: 'c' },
    ];
    expect(renewalsDue(list, today).map((m) => m.id)).toEqual(['expired', 'soon']);
  });

  it('leaves out memberships that ended more than 30 days ago', () => {
    const list = [
      { ...membership('2026-08-01', '2026-09-24'), id: 'recent', memberId: 'a' },
      { ...membership('2026-08-01', '2026-09-23'), id: 'lapsed', memberId: 'b' },
    ];
    expect(renewalsDue(list, today).map((m) => m.id)).toEqual(['recent']);
  });

  it('drops members who have already renewed', () => {
    const list = [
      { ...membership('2026-09-01', '2026-10-20'), id: 'old' },
      { ...membership('2026-10-21', '2026-11-19'), id: 'renewed' },
    ];
    expect(renewalsDue(list, today)).toEqual([]);
  });
});

describe('groupRenewals', () => {
  it('splits running from ended, ending soonest and ended most recently first', () => {
    const list = [
      { ...membership('2026-10-01', '2026-10-28'), id: 'later', memberId: 'a' },
      { ...membership('2026-10-01', '2026-10-24'), id: 'today', memberId: 'b' },
      { ...membership('2026-09-01', '2026-10-10'), id: 'older', memberId: 'c' },
      { ...membership('2026-09-01', '2026-10-23'), id: 'yesterday', memberId: 'd' },
    ];
    const { endingSoon, ended } = groupRenewals(list, today);
    expect(endingSoon.map((m) => m.id)).toEqual(['today', 'later']);
    expect(ended.map((m) => m.id)).toEqual(['yesterday', 'older']);
  });
});

describe('membership dates and prices', () => {
  it('ends a 30 day plan on its 30th day, across month ends', () => {
    expect(endDateFor('2026-10-24', 30)).toBe('2026-11-22');
    expect(endDateFor('2026-12-15', 30)).toBe('2027-01-13');
    expect(endDateFor('2026-10-24', 1)).toBe('2026-10-24');
  });

  it('starts a renewal after the current membership, or today once it has lapsed', () => {
    expect(renewalStart(null, today)).toBe('2026-10-24');
    expect(renewalStart(membership('2026-10-01', '2026-10-30'), today)).toBe('2026-10-31');
    expect(renewalStart(membership('2026-09-01', '2026-10-20'), today)).toBe('2026-10-24');
    expect(renewalStart(membership('2026-09-25', '2026-10-23'), today)).toBe('2026-10-24');
  });

  it('parses rupee amounts into paise', () => {
    expect(parseRupees('1499')).toBe(149900);
    expect(parseRupees('₹ 1,499.50')).toBe(149950);
    expect(parseRupees('0')).toBe(0);
    expect(parseRupees('')).toBeNull();
    expect(parseRupees('12.345')).toBeNull();
    expect(parseRupees('-5')).toBeNull();
  });

  it('formats local dates without shifting to UTC', () => {
    expect(toIsoDate(new Date(2026, 0, 1, 23, 30))).toBe('2026-01-01');
  });
});
