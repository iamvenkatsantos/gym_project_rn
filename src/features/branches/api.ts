import type {
  AdminBranch,
  BillingSettings,
  BranchOwner,
  BranchStats,
} from '@/features/branches/types';
import type { GymDetails } from '@/features/gyms/types';
import { membershipStatus, renewalsDue, latestByMember } from '@/features/memberships/rules';
import {
  delay,
  forGym,
  MOCK_BRAND_ID,
  MOCK_GYM_ID,
  mockAttendance,
  mockDay,
  mockId,
  mockMemberships,
  mockPeople,
} from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type AdminBranchRow = {
  brand_id: string;
  brand_name: string;
  gym_id: string;
  gym_name: string;
  fee_cents: number | null;
  online_payments: boolean;
  razorpay_account_id: string | null;
  online_fees_on_member: boolean;
  address: string;
  city: string;
  phone: string;
  email: string;
  owners: { id: string; full_name: string; email: string }[];
  members: number;
  staff: number;
  created_at: string;
};

type BranchStatsRow = {
  gym_id: string;
  gym_name: string;
  city: string;
  members: number;
  active_members: number;
  renewals_due: number;
  check_ins_today: number;
  revenue_this_month_cents: number;
  currency: string;
};

const mockOwner: BranchOwner = {
  id: 'u-owner',
  fullName: 'Rajesh Kannan',
  email: 'rajesh@example.com',
};

const mockBranches: AdminBranch[] = [
  {
    brandId: MOCK_BRAND_ID,
    brandName: 'Pulse Fitness',
    gymId: MOCK_GYM_ID,
    gymName: 'Pulse Fitness Anna Nagar',
    feeCents: null,
    onlinePayments: false,
    razorpayAccountId: null,
    feesOnMember: true,
    address: '2nd Avenue, Anna Nagar',
    city: 'Chennai',
    phone: '9840012345',
    email: 'hello@corefit.example',
    owners: [mockOwner],
    members: 42,
    staff: 4,
    createdAt: '2026-01-10T09:00:00Z',
  },
  {
    brandId: MOCK_BRAND_ID,
    brandName: 'Pulse Fitness',
    gymId: 'gym-2',
    gymName: 'Pulse Fitness Velachery',
    feeCents: null,
    onlinePayments: false,
    razorpayAccountId: null,
    feesOnMember: true,
    address: '100 Feet Road, Velachery',
    city: 'Chennai',
    phone: '9840054321',
    email: '',
    owners: [mockOwner],
    members: 0,
    staff: 0,
    createdAt: '2026-09-01T09:00:00Z',
  },
  {
    brandId: 'brand-2',
    brandName: 'Iron Den',
    gymId: 'gym-3',
    gymName: 'Iron Den',
    feeCents: 100000,
    onlinePayments: false,
    razorpayAccountId: null,
    feesOnMember: true,
    address: 'Avinashi Road',
    city: 'Coimbatore',
    phone: '04222345678',
    email: 'irondengym@example.com',
    owners: [{ id: 'u-owner-2', fullName: 'Priya Mohan', email: 'priya@example.com' }],
    members: 18,
    staff: 2,
    createdAt: '2026-10-26T09:00:00Z',
  },
];

function toBranch(row: AdminBranchRow): AdminBranch {
  return {
    brandId: row.brand_id,
    brandName: row.brand_name,
    gymId: row.gym_id,
    gymName: row.gym_name,
    feeCents: row.fee_cents,
    onlinePayments: row.online_payments,
    razorpayAccountId: row.razorpay_account_id,
    feesOnMember: row.online_fees_on_member ?? true,
    address: row.address,
    city: row.city,
    phone: row.phone,
    email: row.email,
    owners: row.owners.map((o) => ({ id: o.id, fullName: o.full_name, email: o.email })),
    members: row.members,
    staff: row.staff,
    createdAt: row.created_at,
  };
}

/** Admins only: every branch of every brand. */
export async function fetchAdminBranches(): Promise<AdminBranch[]> {
  if (!supabase) {
    return delay(
      mockBranches.map((b) => ({
        ...b,
        members: b.gymId === MOCK_GYM_ID ? mockMemberCount(b.gymId) : b.members,
      })),
    );
  }
  const rows = unwrap(await supabase.rpc('admin_branches')) as AdminBranchRow[];
  return rows.map(toBranch);
}

/**
 * Admins only. The brand's owners own the new branch; the admin doesn't join it. A null fee
 * keeps the branch on the default fee.
 */
export async function addBranch(
  brandId: string,
  details: GymDetails,
  feeCents: number | null,
): Promise<string> {
  if (!supabase) {
    const brand = mockBranches.find((b) => b.brandId === brandId);
    if (!brand) throw new Error("That brand doesn't exist");
    const gymId = mockId('gym');
    mockBranches.push({
      ...brand,
      gymId,
      gymName: details.name,
      feeCents,
      onlinePayments: false,
      razorpayAccountId: null,
      feesOnMember: true,
      address: details.address,
      city: details.city,
      phone: details.phone,
      email: details.email,
      members: 0,
      staff: 0,
      createdAt: new Date().toISOString(),
    });
    return delay(gymId);
  }
  return unwrap(
    await supabase.rpc('admin_add_branch', {
      p_brand_id: brandId,
      p_name: details.name,
      p_address: details.address,
      p_city: details.city,
      p_phone: details.phone,
      p_email: details.email,
    }),
  ) as string;
}

const mockSettings: BillingSettings = {
  branchFeeCents: 150000,
  onlineAddonCents: 50000,
  onlineCutBps: 100,
  currency: 'INR',
};

/** Admins only: the standard monthly fee per branch. */
export async function fetchBillingSettings(): Promise<BillingSettings> {
  if (!supabase) return delay({ ...mockSettings });
  const row = unwrap(
    await supabase
      .from('platform_settings')
      .select('branch_fee_cents, online_addon_cents, online_cut_bps, currency')
      .single(),
  ) as {
    branch_fee_cents: number;
    online_addon_cents: number;
    online_cut_bps: number;
    currency: string;
  };
  return {
    branchFeeCents: row.branch_fee_cents,
    onlineAddonCents: row.online_addon_cents,
    onlineCutBps: row.online_cut_bps,
    currency: row.currency,
  };
}

/** Admins only. */
export async function setBranchFee(feeCents: number) {
  if (!supabase) {
    mockSettings.branchFeeCents = feeCents;
    return delay(undefined);
  }
  const { error } = await supabase.rpc('admin_set_branch_fee', { p_fee_cents: feeCents });
  if (error) throw error;
}

/** Admins only. Null puts the branch back on the default fee. */
export async function setGymFee(gymId: string, feeCents: number | null) {
  if (!supabase) {
    const branch = mockBranches.find((b) => b.gymId === gymId);
    if (branch) branch.feeCents = feeCents;
    return delay(undefined);
  }
  const { error } = await supabase.rpc('admin_set_gym_fee', {
    p_gym_id: gymId,
    p_fee_cents: feeCents,
  });
  if (error) throw error;
}

/**
 * Admins only. Switches online payments on or off for a branch and sets the owner's
 * Razorpay linked account (acc_...) its payments go to; blank clears it.
 */
export async function setOnlinePayments(gymId: string, enabled: boolean, accountId: string) {
  const account = accountId.trim() || null;
  if (!supabase) {
    const branch = mockBranches.find((b) => b.gymId === gymId);
    if (branch) Object.assign(branch, { onlinePayments: enabled, razorpayAccountId: account });
    return delay(undefined);
  }
  const { error } = await supabase.rpc('admin_set_online_payments', {
    p_gym_id: gymId,
    p_enabled: enabled,
    p_account_id: account,
  });
  if (error) throw error;
}

/** Admins only. Whether the branch's members pay Razorpay's fees on top of the price. */
export async function setOnlineFeesOnMember(gymId: string, onMember: boolean) {
  if (!supabase) {
    const branch = mockBranches.find((b) => b.gymId === gymId);
    if (branch) branch.feesOnMember = onMember;
    return delay(undefined);
  }
  const { error } = await supabase.rpc('admin_set_online_fees_on_member', {
    p_gym_id: gymId,
    p_on_member: onMember,
  });
  if (error) throw error;
}

/** Admins only. */
export async function renameBrand(brandId: string, name: string) {
  if (!supabase) {
    for (const b of mockBranches) if (b.brandId === brandId) b.brandName = name;
    return delay(undefined);
  }
  const { error } = await supabase.rpc('admin_rename_brand', { p_brand_id: brandId, p_name: name });
  if (error) throw error;
}

function mockMemberCount(gymId: string) {
  return forGym(gymId, mockPeople).filter((p) => p.role === 'member' && p.status === 'active')
    .length;
}

/** The demo gym's numbers, worked out like its dashboard so the two agree. */
function mockStats(branch: AdminBranch): BranchStats {
  const memberships = forGym(branch.gymId, mockMemberships);
  const latest = [...latestByMember(memberships).values()];
  const thisMonth = mockDay().slice(0, 7);
  return {
    gymId: branch.gymId,
    gymName: branch.gymName,
    city: branch.city,
    members: mockMemberCount(branch.gymId),
    activeMembers: latest.filter((m) => {
      const status = membershipStatus(m);
      return status === 'active' || status === 'expiringSoon';
    }).length,
    renewalsDue: renewalsDue(memberships).length,
    checkInsToday: forGym(branch.gymId, mockAttendance).filter(
      (a) => a.role === 'member' && a.day === mockDay(),
    ).length,
    revenueThisMonthCents: memberships
      .filter((m) => m.startsOn.startsWith(thisMonth))
      .reduce((total, m) => total + (m.amountPaidCents ?? m.plan.priceCents), 0),
    currency: 'INR',
  };
}

/** The brand's owners only: each branch they own, side by side. */
export async function fetchBrandOverview(brandId: string): Promise<BranchStats[]> {
  if (!supabase) {
    return delay(mockBranches.filter((b) => b.brandId === brandId).map((b) => mockStats(b)));
  }
  const rows = unwrap(
    await supabase.rpc('brand_overview', { p_brand_id: brandId }),
  ) as BranchStatsRow[];
  return rows.map((r) => ({
    gymId: r.gym_id,
    gymName: r.gym_name,
    city: r.city,
    members: r.members,
    activeMembers: r.active_members,
    renewalsDue: r.renewals_due,
    checkInsToday: r.check_ins_today,
    // bigint comes back as a number or a string depending on size.
    revenueThisMonthCents: Number(r.revenue_this_month_cents),
    currency: r.currency,
  }));
}
