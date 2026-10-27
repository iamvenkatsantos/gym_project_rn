import type { AdminBranch, BranchOwner, BranchStats } from '@/features/branches/types';
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
  city: string;
  owners: { id: string; full_name: string; email: string }[];
  members: number;
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
    city: 'Chennai',
    owners: [mockOwner],
    members: 42,
    createdAt: '2026-01-10T09:00:00Z',
  },
  {
    brandId: MOCK_BRAND_ID,
    brandName: 'Pulse Fitness',
    gymId: 'gym-2',
    gymName: 'Pulse Fitness Velachery',
    city: 'Chennai',
    owners: [mockOwner],
    members: 0,
    createdAt: '2026-09-01T09:00:00Z',
  },
  {
    brandId: 'brand-2',
    brandName: 'Iron Den',
    gymId: 'gym-3',
    gymName: 'Iron Den',
    city: 'Coimbatore',
    owners: [{ id: 'u-owner-2', fullName: 'Priya Mohan', email: 'priya@example.com' }],
    members: 18,
    createdAt: '2026-10-26T09:00:00Z',
  },
];

function toBranch(row: AdminBranchRow): AdminBranch {
  return {
    brandId: row.brand_id,
    brandName: row.brand_name,
    gymId: row.gym_id,
    gymName: row.gym_name,
    city: row.city,
    owners: row.owners.map((o) => ({ id: o.id, fullName: o.full_name, email: o.email })),
    members: row.members,
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

/** Admins only. The brand's owners own the new branch; the admin doesn't join it. */
export async function addBranch(brandId: string, details: GymDetails): Promise<string> {
  if (!supabase) {
    const brand = mockBranches.find((b) => b.brandId === brandId);
    if (!brand) throw new Error("That brand doesn't exist");
    const gymId = mockId('gym');
    mockBranches.push({
      ...brand,
      gymId,
      gymName: details.name,
      city: details.city,
      members: 0,
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
