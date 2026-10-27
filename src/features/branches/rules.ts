import type { GymRole } from '@/features/auth/types';
import type {
  AdminBranch,
  AdminBrand,
  BranchOwner,
  BranchStats,
  OwnerBranchCount,
} from '@/features/branches/types';

/** Groups the admin's branch list by brand, keeping the server's order. */
export function groupBrands(branches: AdminBranch[]): AdminBrand[] {
  const brands = new Map<string, AdminBrand>();
  for (const branch of branches) {
    let brand = brands.get(branch.brandId);
    if (!brand) {
      brand = { brandId: branch.brandId, brandName: branch.brandName, owners: [], branches: [] };
      brands.set(branch.brandId, brand);
    }
    brand.branches.push(branch);
    for (const owner of branch.owners) {
      if (!brand.owners.some((o) => o.id === owner.id)) brand.owners.push(owner);
    }
  }
  return [...brands.values()];
}

/** Branch counts per owner for billing, most branches first. */
export function branchCountsByOwner(branches: AdminBranch[]): OwnerBranchCount[] {
  const counts = new Map<string, OwnerBranchCount>();
  for (const branch of branches) {
    for (const owner of branch.owners) {
      let count = counts.get(owner.id);
      if (!count) {
        count = { owner, branches: 0, brands: [] };
        counts.set(owner.id, count);
      }
      count.branches += 1;
      if (!count.brands.includes(branch.brandName)) count.brands.push(branch.brandName);
    }
  }
  return [...counts.values()].sort(
    (a, b) => b.branches - a.branches || a.owner.fullName.localeCompare(b.owner.fullName),
  );
}

export function ownerNames(owners: BranchOwner[]) {
  return owners.length ? owners.map((o) => o.fullName || o.email).join(', ') : 'No owner yet';
}

/** The branches of the active gym's brand that this person owns, the active one included. */
export function ownedBranches(gyms: GymRole[], active: GymRole): GymRole[] {
  if (active.role !== 'owner' || !active.brandId) return [];
  return gyms.filter((g) => g.role === 'owner' && g.brandId === active.brandId);
}

/**
 * A branch's short name: "Pulse Fitness Anna Nagar" in the Pulse Fitness brand is
 * "Anna Nagar". Names that don't start with the brand stay as they are.
 */
export function branchLabel(gymName: string, brandName?: string) {
  if (!brandName) return gymName;
  const prefix = brandName.trim().toLowerCase();
  const rest = gymName.slice(prefix.length).replace(/^[\s,–—-]+/, '');
  return gymName.toLowerCase().startsWith(prefix) && rest ? rest : gymName;
}

/** Every branch added together. Revenue only adds up when the branches share a currency. */
export function totalStats(branches: BranchStats[]) {
  const currencies = new Set(branches.map((b) => b.currency));
  return {
    members: sum(branches, 'members'),
    activeMembers: sum(branches, 'activeMembers'),
    renewalsDue: sum(branches, 'renewalsDue'),
    checkInsToday: sum(branches, 'checkInsToday'),
    revenueThisMonthCents:
      currencies.size <= 1 ? sum(branches, 'revenueThisMonthCents') : (null as number | null),
    currency: branches[0]?.currency ?? 'INR',
  };
}

type NumberKey = {
  [K in keyof BranchStats]: BranchStats[K] extends number ? K : never;
}[keyof BranchStats];

function sum(branches: BranchStats[], key: NumberKey) {
  return branches.reduce((total, b) => total + b[key], 0);
}
