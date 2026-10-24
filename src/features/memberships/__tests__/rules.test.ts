import { daysRemaining, membershipStatus } from '@/features/memberships/rules';
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
