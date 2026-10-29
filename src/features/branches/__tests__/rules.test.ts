import type { GymRole } from '@/features/auth/types';
import {
  branchBill,
  branchFee,
  branchLabel,
  groupBrands,
  onlinePaymentExample,
  ownedBranches,
  ownerAccounts,
  totalStats,
  unownedBranches,
  unpaidBranches,
  yearlyTotal,
} from '@/features/branches/rules';
import type { AdminBranch, BranchStats } from '@/features/branches/types';

const raj = { id: 'u1', fullName: 'Rajesh', email: 'raj@example.com' };
const priya = { id: 'u2', fullName: 'Priya', email: 'priya@example.com' };

const billing = {
  branchFeeCents: 150000,
  onlineAddonCents: 50000,
  onlineCutBps: 0,
  currency: 'INR',
};

function branch(
  gymId: string,
  brandId: string,
  owners = [raj],
  feeCents: number | null = null,
  onlinePayments = false,
): AdminBranch {
  return {
    brandId,
    brandName: brandId === 'b1' ? 'Pulse Fitness' : 'Iron Den',
    gymId,
    gymName: gymId,
    feeCents,
    onlinePayments,
    razorpayAccountId: null,
    feesOnMember: true,
    paidUntil: null,
    address: '',
    city: '',
    phone: '',
    email: '',
    owners,
    members: 0,
    staff: 0,
    createdAt: '2026-10-27T00:00:00Z',
  };
}

describe('groupBrands', () => {
  it('groups branches by brand and collects every owner once', () => {
    const brands = groupBrands([
      branch('g1', 'b1'),
      branch('g2', 'b1', [raj, priya]),
      branch('g3', 'b2', [priya]),
    ]);
    expect(brands.map((b) => [b.brandId, b.branches.length])).toEqual([
      ['b1', 2],
      ['b2', 1],
    ]);
    expect(brands[0].owners.map((o) => o.id)).toEqual(['u1', 'u2']);
  });
});

describe('billing', () => {
  const list = [
    branch('g1', 'b1'),
    branch('g2', 'b1', [raj, priya]),
    branch('g3', 'b2', [priya], 100000),
    branch('g4', 'b2', [priya], 100000),
    branch('g5', 'b2', [], 100000),
  ];

  it("uses the branch's own fee, else the default", () => {
    expect(branchFee(list[0], billing)).toBe(150000);
    expect(branchFee(list[2], billing)).toBe(100000);
    expect(branchFee({ feeCents: 0 }, billing)).toBe(0);
  });

  it('adds the online payments add-on to branches that have it', () => {
    expect(branchBill(list[0], billing)).toBe(150000);
    expect(branchBill(branch('g6', 'b1', [raj], null, true), billing)).toBe(200000);
    // A free branch pays no add-on either.
    expect(branchBill(branch('g7', 'b1', [raj], 0, true), billing)).toBe(0);
    expect(yearlyTotal([...list, branch('g6', 'b1', [], 100000, true)], billing)).toBe(
      150000 * 2 + 100000 * 4 + 50000,
    );
  });

  it('totals every branch once, owned or not', () => {
    expect(yearlyTotal(list, billing)).toBe(150000 * 2 + 100000 * 3);
  });

  it("lists each owner's brands, branches and amount, biggest first", () => {
    const accounts = ownerAccounts(list, billing);
    expect(
      accounts.map((a) => [a.owner.id, a.branches, a.yearlyCents, a.brands.map((b) => b.brandId)]),
    ).toEqual([
      ['u2', 3, 350000, ['b1', 'b2']],
      ['u1', 2, 300000, ['b1']],
    ]);
    expect(accounts[0].brands[1].branches.map((b) => b.gymId)).toEqual(['g3', 'g4']);
  });

  it('finds branches with no owner', () => {
    expect(unownedBranches(list).map((b) => b.gymId)).toEqual(['g5']);
  });
});

describe('ownedBranches', () => {
  const gyms: GymRole[] = [
    { gymId: 'g1', gymName: 'A', role: 'owner', brandId: 'b1' },
    { gymId: 'g2', gymName: 'B', role: 'owner', brandId: 'b1' },
    { gymId: 'g3', gymName: 'C', role: 'owner', brandId: 'b2' },
    { gymId: 'g4', gymName: 'D', role: 'member', brandId: 'b1' },
  ];

  it("lists the owner's branches of the active brand", () => {
    expect(ownedBranches(gyms, gyms[0]).map((g) => g.gymId)).toEqual(['g1', 'g2']);
  });

  it('is empty when the active role is not owner', () => {
    expect(ownedBranches(gyms, gyms[3])).toEqual([]);
  });
});

describe('branchLabel', () => {
  it('drops the brand from the front of the name', () => {
    expect(branchLabel('Pulse Fitness Anna Nagar', 'Pulse Fitness')).toBe('Anna Nagar');
    expect(branchLabel('Pulse Fitness - Velachery', 'pulse fitness')).toBe('Velachery');
  });

  it('keeps names that are just the brand or something else', () => {
    expect(branchLabel('Pulse Fitness', 'Pulse Fitness')).toBe('Pulse Fitness');
    expect(branchLabel('Iron Den', 'Pulse Fitness')).toBe('Iron Den');
    expect(branchLabel('Iron Den')).toBe('Iron Den');
  });
});

describe('totalStats', () => {
  const stats = (gymId: string, cents: number, currency = 'INR'): BranchStats => ({
    gymId,
    gymName: gymId,
    city: '',
    members: 10,
    activeMembers: 8,
    renewalsDue: 1,
    checkInsToday: 4,
    revenueThisMonthCents: cents,
    currency,
  });

  it('adds up every branch', () => {
    expect(totalStats([stats('g1', 100), stats('g2', 250)])).toEqual({
      members: 20,
      activeMembers: 16,
      renewalsDue: 2,
      checkInsToday: 8,
      revenueThisMonthCents: 350,
      currency: 'INR',
    });
  });

  it("doesn't add revenue in different currencies", () => {
    expect(
      totalStats([stats('g1', 100), stats('g2', 250, 'USD')]).revenueThisMonthCents,
    ).toBeNull();
  });
});

describe('onlinePaymentExample', () => {
  it('passes the fees and the 1% cut to the member; the owner gets it all', () => {
    expect(onlinePaymentExample(true, 100)).toEqual({
      memberPaysCents: 103744,
      ownerGetsCents: 100000,
      cutCents: 1000,
    });
  });

  it('pays the owner the full price with no cut', () => {
    expect(onlinePaymentExample(true, 0).ownerGetsCents).toBe(100000);
  });

  it('takes every fee and the cut from the owner when the owner bears the fees', () => {
    expect(onlinePaymentExample(false, 100)).toEqual({
      memberPaysCents: 100000,
      ownerGetsCents: 96355,
      cutCents: 1000,
    });
  });

  it('at the old 0.25% cut with the owner paying, a ₹3,200 plan nets the owner ₹3,107.31', () => {
    expect(onlinePaymentExample(false, 25, 320000)).toEqual({
      memberPaysCents: 320000,
      ownerGetsCents: 310731,
      cutCents: 800,
    });
  });

  it('at the default 0.5% cut with the owner paying, a ₹1,000 plan nets the owner ₹968.53', () => {
    expect(onlinePaymentExample(false, 50)).toEqual({
      memberPaysCents: 100000,
      ownerGetsCents: 96853,
      cutCents: 500,
    });
  });
});

describe('unpaidBranches', () => {
  it('lists branches never paid or whose year ended, but not free ones', () => {
    const list = [
      { ...branch('paid', 'b1'), paidUntil: '2027-01-01' },
      { ...branch('ended', 'b1'), paidUntil: '2026-10-28' },
      { ...branch('lastDay', 'b1'), paidUntil: '2026-10-29' },
      branch('never', 'b1'),
      branch('free', 'b2', [priya], 0),
    ];
    expect(unpaidBranches(list, billing, '2026-10-29').map((b) => b.gymId)).toEqual([
      'ended',
      'never',
    ]);
  });
});
