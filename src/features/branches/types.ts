export type BranchOwner = { id: string; fullName: string; email: string };

/** One branch as the CoreFit Gym admin sees it. */
export type AdminBranch = {
  brandId: string;
  brandName: string;
  /** The brand's own monthly fee per branch, or null for the standard fee. */
  brandFeeCents: number | null;
  gymId: string;
  gymName: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  owners: BranchOwner[];
  members: number;
  /** Active trainers and supervisors. */
  staff: number;
  createdAt: string;
};

/** What CoreFit Gym charges: a monthly fee for each branch. */
export type BillingSettings = {
  branchFeeCents: number;
  currency: string;
};

/** A brand with its branches. CoreFit Gym bills per branch. */
export type AdminBrand = {
  brandId: string;
  brandName: string;
  brandFeeCents: number | null;
  owners: BranchOwner[];
  branches: AdminBranch[];
};

/** An owner with every brand and branch they own, and what to collect from them each month. */
export type OwnerAccount = {
  owner: BranchOwner;
  brands: AdminBrand[];
  branches: number;
  monthlyCents: number;
};

/** One branch's numbers for the owner's All branches view. */
export type BranchStats = {
  gymId: string;
  gymName: string;
  city: string;
  members: number;
  activeMembers: number;
  renewalsDue: number;
  checkInsToday: number;
  revenueThisMonthCents: number;
  currency: string;
};
