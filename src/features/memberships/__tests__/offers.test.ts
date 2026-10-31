import {
  earnsLoyalty,
  loyaltyStreakDays,
  offerActive,
  offerProblem,
  offerSummary,
  planOfferCents,
  priceFor,
} from '@/features/memberships/offers';
import type { Membership, MembershipPlan, PlanOffer } from '@/features/memberships/types';

const today = new Date(2026, 9, 31);

function plan(offer: PlanOffer | null = null, priceCents = 120000): MembershipPlan {
  return { id: 'p-1', name: 'Monthly', priceCents, currency: 'INR', durationDays: 30, offer };
}

const tenPercent: PlanOffer = {
  type: 'percent',
  value: 10,
  label: 'Diwali offer',
  startsOn: null,
  endsOn: '2026-11-10',
};

function membership(
  startsOn: string,
  endsOn: string,
  paymentMethod: Membership['paymentMethod'] = 'cash',
  memberId = 'u-1',
): Membership {
  return {
    id: `${memberId}-${startsOn}`,
    memberId,
    memberName: 'Lata',
    plan: plan(),
    startsOn,
    endsOn,
    amountPaidCents: 120000,
    paymentMethod,
  };
}

describe('plan offers', () => {
  it('applies only between its start and end dates', () => {
    expect(offerActive(plan(tenPercent), today)).toBe(true);
    expect(offerActive(plan(tenPercent), new Date(2026, 10, 10))).toBe(true);
    expect(offerActive(plan(tenPercent), new Date(2026, 10, 11))).toBe(false);
    expect(offerActive(plan({ ...tenPercent, startsOn: '2026-11-01' }), today)).toBe(false);
    expect(offerActive(plan(null), today)).toBe(false);
  });

  it('rounds percent offers to whole rupees', () => {
    expect(planOfferCents(plan(tenPercent), today)).toBe(12000);
    expect(planOfferCents(plan(tenPercent, 349900), today)).toBe(35000);
  });

  it('takes a flat amount off', () => {
    const flat: PlanOffer = { ...tenPercent, type: 'flat', value: 20000 };
    expect(priceFor(plan(flat), { today })).toMatchObject({
      priceCents: 100000,
      originalCents: 120000,
      offer: 'Diwali offer',
      savings: '₹200 off',
    });
  });

  it('shows the full price without an active offer', () => {
    expect(priceFor(plan(tenPercent), { today: new Date(2026, 10, 12) })).toMatchObject({
      priceCents: 120000,
      offer: null,
    });
  });

  it('summarises the offer', () => {
    expect(offerSummary(plan(tenPercent))).toBe('Diwali offer · 10% off till 10 Nov 2026');
    expect(offerSummary(plan({ ...tenPercent, label: ' ' }))).toBe(
      'Offer · 10% off till 10 Nov 2026',
    );
  });

  it('refuses bad offers', () => {
    expect(offerProblem({ ...tenPercent, value: 0 }, 120000, today)).toBe('Enter the discount.');
    expect(offerProblem({ ...tenPercent, value: 95 }, 120000, today)).toMatch(/1–90%/);
    expect(offerProblem({ ...tenPercent, type: 'flat', value: 120000 }, 120000, today)).toBe(
      'Take off less than the price.',
    );
    expect(offerProblem({ ...tenPercent, endsOn: '2026-10-30' }, 120000, today)).toBe(
      'The end date has passed.',
    );
    expect(offerProblem(tenPercent, 120000, today)).toBeNull();
  });
});

describe('loyalty offer', () => {
  const backToBack = [
    membership('2026-09-06', '2026-10-05'),
    membership('2026-10-06', '2026-11-04'),
  ];

  it('counts the days paid without a break', () => {
    expect(loyaltyStreakDays(backToBack, 'u-1', '2026-11-05')).toBe(60);
  });

  it('forgives a break of up to 7 days', () => {
    const late = [membership('2026-08-31', '2026-09-29'), membership('2026-10-07', '2026-11-05')];
    expect(loyaltyStreakDays(late, 'u-1', '2026-11-06')).toBe(67);
    const tooLate = [
      membership('2026-08-30', '2026-09-28'),
      membership('2026-10-07', '2026-11-05'),
    ];
    expect(loyaltyStreakDays(tooLate, 'u-1', '2026-11-06')).toBe(30);
  });

  it('ignores complimentary memberships and other members', () => {
    const mixed = [
      membership('2026-09-06', '2026-10-05', 'complimentary'),
      membership('2026-09-06', '2026-10-05', 'cash', 'u-2'),
      membership('2026-10-06', '2026-11-04'),
    ];
    expect(loyaltyStreakDays(mixed, 'u-1', '2026-11-05')).toBe(30);
  });

  it('starts after the set months', () => {
    const loyalty = { months: 2, percent: 15 };
    expect(earnsLoyalty(loyalty, backToBack, 'u-1', '2026-11-05')).toBe(true);
    expect(earnsLoyalty({ ...loyalty, months: 3 }, backToBack, 'u-1', '2026-11-05')).toBe(false);
    expect(earnsLoyalty(null, backToBack, 'u-1', '2026-11-05')).toBe(false);
  });

  it('gives whichever offer takes more off, never both', () => {
    const args = { memberships: backToBack, memberId: 'u-1', startsOn: '2026-11-05', today };
    expect(priceFor(plan(tenPercent), { ...args, loyalty: { months: 2, percent: 15 } })).toEqual({
      priceCents: 102000,
      originalCents: 120000,
      offer: 'Loyalty offer',
      savings: '15% off',
    });
    expect(
      priceFor(plan(tenPercent), { ...args, loyalty: { months: 2, percent: 5 } }),
    ).toMatchObject({ priceCents: 108000, offer: 'Diwali offer' });
  });
});
