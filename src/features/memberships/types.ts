export type MembershipPlan = {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  durationDays: number;
};

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'online' | 'complimentary';

export type Membership = {
  id: string;
  memberId: string;
  memberName: string;
  plan: MembershipPlan;
  startsOn: string;
  endsOn: string;
  amountPaidCents: number | null;
  paymentMethod: PaymentMethod | null;
};

export type PlanInput = Pick<MembershipPlan, 'name' | 'priceCents' | 'durationDays'>;

/** What the front desk records when someone pays for a membership in person. */
export type MembershipInput = {
  memberId: string;
  planId: string;
  startsOn: string;
  endsOn: string;
  amountPaidCents: number;
  paymentMethod: PaymentMethod;
  note: string;
};
