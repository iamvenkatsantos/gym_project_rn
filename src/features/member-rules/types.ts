/** Per-branch rules the owner sets on Member rules. Members read them too. */
export type MemberRules = {
  /** Days a member can pause each membership; 0 = pausing is off. */
  pauseMaxDays: number;
  /** Free days a member gets when a friend they referred joins; 0 = no reward. */
  referralRewardDays: number;
  /** Upcoming classes (booked or waitlisted) a member can hold at once; null = no limit. */
  classBookingCap: number | null;
};

export const DEFAULT_MEMBER_RULES: MemberRules = {
  pauseMaxDays: 0,
  referralRewardDays: 0,
  classBookingCap: null,
};
