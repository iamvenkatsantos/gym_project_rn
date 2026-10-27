export type BranchOwner = { id: string; fullName: string; email: string };

/** One branch as the CoreFit Gym admin sees it. */
export type AdminBranch = {
  brandId: string;
  brandName: string;
  gymId: string;
  gymName: string;
  /** This branch's own monthly fee, or null for the default fee. */
  feeCents: number | null;
  /** Whether members can pay online (a paid add-on). */
  onlinePayments: boolean;
  /** The owner's Razorpay Route linked account that online payments go to. */
  razorpayAccountId: string | null;
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

/** What CoreFit Gym charges: a default monthly fee for each branch, plus add-ons. */
export type BillingSettings = {
  branchFeeCents: number;
  /** The online payments add-on, per branch that has it switched on. */
  onlineAddonCents: number;
  currency: string;
};

/** A brand with its branches. CoreFit Gym bills per branch. */
export type AdminBrand = {
  brandId: string;
  brandName: string;
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
