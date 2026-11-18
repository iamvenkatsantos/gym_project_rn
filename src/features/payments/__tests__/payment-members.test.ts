import { listPaymentMembers, PAYMENT_MEMBERS_PAGE_SIZE } from '@/features/payments/api';
import { MOCK_GYM_ID } from '@/lib/mock-db';

jest.mock('@/lib/supabase', () => ({ supabase: null, unwrap: (r: { data: unknown }) => r.data }));

describe('listPaymentMembers (demo path)', () => {
  it('pages the members with payments and searches by name', async () => {
    const first = await listPaymentMembers(MOCK_GYM_ID, '', 0);
    expect(first.members.length).toBeLessThanOrEqual(PAYMENT_MEMBERS_PAGE_SIZE);
    expect(first.total).toBeGreaterThan(0);
    const name = first.members[0].memberName;
    const found = await listPaymentMembers(MOCK_GYM_ID, name.slice(0, 3).toUpperCase(), 0);
    expect(found.members.some((m) => m.memberName === name)).toBe(true);
    const none = await listPaymentMembers(MOCK_GYM_ID, 'zzzzzz', 0);
    expect(none).toEqual({ members: [], total: 0, nextOffset: null });
  });
});
