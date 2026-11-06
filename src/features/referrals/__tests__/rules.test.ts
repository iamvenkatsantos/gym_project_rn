import { referralLabel, referralMessage } from '@/features/referrals/rules';
import type { Referral } from '@/features/referrals/types';

const referral: Referral = {
  id: 'r-1',
  fullName: 'Kavi Friend',
  status: 'pending',
  rewardDays: null,
  rewardApplied: false,
  createdAt: '2026-11-06T10:00:00Z',
};

describe('referralLabel', () => {
  it('says where each referral stands', () => {
    expect(referralLabel(referral)).toBe('Gym will call them');
    expect(referralLabel({ ...referral, status: 'closed' })).toBe("Didn't join");
    expect(referralLabel({ ...referral, status: 'joined', rewardDays: 0 })).toBe('Joined');
    expect(
      referralLabel({ ...referral, status: 'joined', rewardDays: 7, rewardApplied: true }),
    ).toBe('Joined · +7 days');
    expect(referralLabel({ ...referral, status: 'joined', rewardDays: 7 })).toBe(
      'Joined · +7 days on your next plan',
    );
  });
});

describe('referralMessage', () => {
  it('greets the friend by first name and names the gym', () => {
    const text = referralMessage(' Kavi Friend ', 'Pulse Fitness');
    expect(text.startsWith('Hi Kavi,')).toBe(true);
    expect(text).toContain('Pulse Fitness');
  });
});
