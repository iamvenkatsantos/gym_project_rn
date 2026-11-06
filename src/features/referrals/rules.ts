import type { Referral } from '@/features/referrals/types';

/** The short status line under a referral. */
export function referralLabel(referral: Referral) {
  if (referral.status === 'pending') return 'Gym will call them';
  if (referral.status === 'closed') return "Didn't join";
  if (!referral.rewardDays) return 'Joined';
  return referral.rewardApplied
    ? `Joined · +${referral.rewardDays} days`
    : `Joined · +${referral.rewardDays} days on your next plan`;
}

/** The WhatsApp message a member sends the friend they referred. */
export function referralMessage(friendName: string, gymName: string) {
  const first = friendName.trim().split(/\s+/)[0] || 'there';
  return `Hi ${first}, I train at ${gymName} and love it. I've passed your number to the gym, so they'll call you. Come try it with me!`;
}
