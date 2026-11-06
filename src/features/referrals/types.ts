/** pending: the gym is following up; joined: they paid for a membership; closed: they didn't join. */
export type ReferralStatus = 'pending' | 'joined' | 'closed';

/** A friend a member referred, as the member sees it. */
export type Referral = {
  id: string;
  fullName: string;
  status: ReferralStatus;
  /** Free days earned once they joined; null before, 0 when the gym gives none. */
  rewardDays: number | null;
  /** False while the days wait for the member's next membership. */
  rewardApplied: boolean;
  createdAt: string;
};
