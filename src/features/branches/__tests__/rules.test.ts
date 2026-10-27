import type { GymRole } from '@/features/auth/types';
import {
  branchCountsByOwner,
  branchLabel,
  groupBrands,
  ownedBranches,
  totalStats,
} from '@/features/branches/rules';
import type { AdminBranch, BranchStats } from '@/features/branches/types';

const raj = { id: 'u1', fullName: 'Rajesh', email: 'raj@example.com' };
const priya = { id: 'u2', fullName: 'Priya', email: 'priya@example.com' };

function branch(gymId: string, brandId: string, owners = [raj]): AdminBranch {
  return {
    brandId,
    brandName: brandId === 'b1' ? 'Pulse Fitness' : 'Iron Den',
    gymId,
    gymName: gymId,
    city: '',
    owners,
    members: 0,
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

describe('branchCountsByOwner', () => {
  it('counts branches per owner across brands, most first', () => {
    const counts = branchCountsByOwner([
      branch('g1', 'b1'),
      branch('g2', 'b1', [raj, priya]),
      branch('g3', 'b2', [priya]),
      branch('g4', 'b2', [priya]),
    ]);
    expect(counts.map((c) => [c.owner.id, c.branches, c.brands])).toEqual([
      ['u2', 3, ['Pulse Fitness', 'Iron Den']],
      ['u1', 2, ['Pulse Fitness']],
    ]);
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
