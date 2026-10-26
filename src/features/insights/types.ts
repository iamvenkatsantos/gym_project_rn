/** Money taken in one month. `month` is its first day, YYYY-MM-DD. */
export type MonthRevenue = {
  month: string;
  amountCents: number;
  payments: number;
  /** Members whose first membership at the gym was recorded this month. */
  newMembers: number;
  currency: string;
};

/** An active member, their latest membership and how often they come in. */
export type MemberInsight = {
  userId: string;
  fullName: string;
  joinedOn: string | null;
  /** The latest membership, or null if they never had one. */
  startsOn: string | null;
  endsOn: string | null;
  lastVisit: string | null;
  visitsLast30Days: number;
};

/** Member check-ins at one hour of one weekday. Weekday 1 is Monday, 7 is Sunday. */
export type HourCount = { weekday: number; hour: number; checkIns: number };
