export type BranchOwner = { id: string; fullName: string; email: string };

/** One branch as the CoreFit Gym admin sees it. */
export type AdminBranch = {
  brandId: string;
  brandName: string;
  gymId: string;
  gymName: string;
  /** This branch's own yearly fee, or null for the default fee. */
  feeCents: number | null;
  /** Whether members can pay online (a paid add-on). */
  onlinePayments: boolean;
  /** The owner's Razorpay Route linked account that online payments go to. */
  razorpayAccountId: string | null;
  /** Whether members pay Razorpay's fees on top of the price, so the owner gets it all. */
  feesOnMember: boolean;
  /** The last day the branch's CoreFit Gym plan is paid for; null if never paid. */
  paidUntil: string | null;
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

/** What CoreFit Gym charges: a default yearly fee for each branch, plus add-ons. */
export type BillingSettings = {
  branchFeeCents: number;
  /** The online payments add-on per year, per branch that has it switched on. */
  onlineAddonCents: number;
  /** CoreFit Gym's cut of each online payment, in basis points (100 = 1%). */
  onlineCutBps: number;
  currency: string;
};

/** A brand with its branches. CoreFit Gym bills per branch. */
export type AdminBrand = {
  brandId: string;
  brandName: string;
  owners: BranchOwner[];
  branches: AdminBranch[];
};

/** An owner with every brand and branch they own, and what to collect from them each year. */
export type OwnerAccount = {
  owner: BranchOwner;
  brands: AdminBrand[];
  branches: number;
  yearlyCents: number;
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
