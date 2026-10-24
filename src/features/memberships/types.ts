export type MembershipPlan = {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  durationDays: number;
};

export type Membership = {
  id: string;
  memberId: string;
  memberName: string;
  plan: MembershipPlan;
  startsOn: string;
  endsOn: string;
};
