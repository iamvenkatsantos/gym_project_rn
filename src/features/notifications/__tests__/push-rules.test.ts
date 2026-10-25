import type { GymRole } from '@/features/auth/types';
import { gymForPush, parsePushData } from '@/features/notifications/rules';

const gyms: GymRole[] = [
  { gymId: 'anna-nagar', gymName: 'CoreFit Anna Nagar', role: 'member' },
  { gymId: 'velachery', gymName: 'CoreFit Velachery', role: 'trainer' },
];

describe('push data', () => {
  it('reads what the server sends', () => {
    expect(
      parsePushData({ notificationId: 'n1', gymId: 'velachery', kind: 'reminder', classId: null }),
    ).toEqual({ notificationId: 'n1', gymId: 'velachery', kind: 'reminder' });
  });

  it('ignores pushes that are not ours', () => {
    expect(parsePushData(undefined)).toBeNull();
    expect(parsePushData({})).toBeNull();
    expect(parsePushData({ notificationId: 'n1', gymId: 'g', kind: 'promo' })).toBeNull();
  });

  it("opens the push's own gym, even if another one is active", () => {
    const push = { notificationId: 'n1', gymId: 'velachery', kind: 'booking' } as const;
    expect(gymForPush(push, gyms)).toBe('velachery');
  });

  it('opens nothing for a gym they have left', () => {
    const push = { notificationId: 'n1', gymId: 'old-gym', kind: 'membership' } as const;
    expect(gymForPush(push, gyms)).toBeNull();
  });
});
