import { getOwnerDashboard, HOME_RENEWALS_SHOWN } from '@/features/dashboard/api';
import { listMemberships } from '@/features/memberships/api';
import { latestByMember, membershipStatus, renewalsDue } from '@/features/memberships/rules';
import { MOCK_GYM_ID } from '@/lib/mock-db';

jest.mock('@/lib/supabase', () => ({ supabase: null, unwrap: (r: { data: unknown }) => r.data }));

describe('owner dashboard (demo mode)', () => {
  it('shows the same numbers the screens work out from the full lists', async () => {
    const today = new Date();
    const all = await listMemberships(MOCK_GYM_ID);
    const dashboard = await getOwnerDashboard(MOCK_GYM_ID, today);
    const active = [...latestByMember(all).values()].filter((m) =>
      ['active', 'expiringSoon'].includes(membershipStatus(m, today)),
    );
    expect(dashboard.activeMembers).toBe(active.length);
    expect(dashboard.renewalsDue).toBe(renewalsDue(all, today).length);
    expect(dashboard.renewals.map((m) => m.id)).toEqual(
      renewalsDue(all, today)
        .slice(0, HOME_RENEWALS_SHOWN)
        .map((m) => m.id),
    );
  });
});
