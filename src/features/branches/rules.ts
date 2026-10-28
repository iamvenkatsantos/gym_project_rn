import type { GymRole } from '@/features/auth/types';
import type {
  AdminBranch,
  AdminBrand,
  BillingSettings,
  BranchOwner,
  BranchStats,
  OwnerAccount,
} from '@/features/branches/types';

import { gatewayFee, memberPrice, routeTransfer } from '../../../supabase/functions/_shared/fees';

/** Groups the admin's branch list by brand, keeping the server's order. */
export function groupBrands(branches: AdminBranch[]): AdminBrand[] {
  const brands = new Map<string, AdminBrand>();
  for (const branch of branches) {
    let brand = brands.get(branch.brandId);
    if (!brand) {
      brand = {
        brandId: branch.brandId,
        brandName: branch.brandName,
        owners: [],
        branches: [],
      };
      brands.set(branch.brandId, brand);
    }
    brand.branches.push(branch);
    for (const owner of branch.owners) {
      if (!brand.owners.some((o) => o.id === owner.id)) brand.owners.push(owner);
    }
  }
  return [...brands.values()];
}

/** A branch's monthly fee: its own, else the default. */
export function branchFee(branch: Pick<AdminBranch, 'feeCents'>, settings: BillingSettings) {
  return branch.feeCents ?? settings.branchFeeCents;
}

/** What a branch pays each month: its fee plus the online payments add-on when it's on. */
export function branchBill(
  branch: Pick<AdminBranch, 'feeCents' | 'onlinePayments'>,
  settings: BillingSettings,
) {
  return branchFee(branch, settings) + (branch.onlinePayments ? settings.onlineAddonCents : 0);
}

/** What to collect each month across every branch. Co-owned branches count once. */
export function monthlyTotal(branches: AdminBranch[], settings: BillingSettings) {
  return branches.reduce((total, b) => total + branchBill(b, settings), 0);
}

/**
 * Each owner with the brands and branches they own and what to collect from them each month,
 * the biggest accounts first. A branch with two owners shows under both.
 */
export function ownerAccounts(branches: AdminBranch[], settings: BillingSettings): OwnerAccount[] {
  const owned = new Map<string, { owner: BranchOwner; branches: AdminBranch[] }>();
  for (const branch of branches) {
    for (const owner of branch.owners) {
      const entry = owned.get(owner.id) ?? { owner, branches: [] };
      entry.branches.push(branch);
      owned.set(owner.id, entry);
    }
  }
  return [...owned.values()]
    .map(({ owner, branches: list }) => ({
      owner,
      brands: groupBrands(list),
      branches: list.length,
      monthlyCents: monthlyTotal(list, settings),
    }))
    .sort(
      (a, b) =>
        b.monthlyCents - a.monthlyCents ||
        b.branches - a.branches ||
        a.owner.fullName.localeCompare(b.owner.fullName),
    );
}

/** Branches nobody owns yet, say after an owner left. They still count towards the total. */
export function unownedBranches(branches: AdminBranch[]) {
  return branches.filter((b) => b.owners.length === 0);
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

/**
 * What a ₹1,000 plan works out to at a branch: what the member pays and what the
 * owner receives after Razorpay's fees and CoreFit Gym's cut.
 */
export function onlinePaymentExample(feesOnMember: boolean, cutBps: number, baseCents = 100000) {
  const cutCents = Math.floor((baseCents * cutBps) / 10000);
  const price = memberPrice(baseCents, cutCents, feesOnMember);
  const available = price.amountCents - gatewayFee(price.amountCents) - cutCents;
  return {
    memberPaysCents: price.amountCents,
    ownerGetsCents: routeTransfer(available)?.transfer ?? 0,
    cutCents,
  };
}
