export type BranchOwner = { id: string; fullName: string; email: string };

/** One branch as the CoreFit Gym admin sees it. */
export type AdminBranch = {
  brandId: string;
  brandName: string;
  gymId: string;
  gymName: string;
  city: string;
  owners: BranchOwner[];
  members: number;
  createdAt: string;
};

/** A brand with its branches. CoreFit Gym bills per branch. */
export type AdminBrand = {
  brandId: string;
  brandName: string;
  owners: BranchOwner[];
  branches: AdminBranch[];
};

/** How many branches each owner has, across every brand they own. */
export type OwnerBranchCount = {
  owner: BranchOwner;
  branches: number;
  brands: string[];
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
