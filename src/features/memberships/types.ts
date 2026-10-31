export type MembershipPlan = {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  durationDays: number;
  /** A time-limited discount the owner put on the plan. */
  offer?: PlanOffer | null;
};

/** A discount on a plan for a while: a percentage or a flat amount off. */
export type PlanOffer = {
  type: 'percent' | 'flat';
  /** Percent (1–90) or paise off. */
  value: number;
  /** e.g. "Diwali offer"; empty shows as "Offer". */
  label: string;
  /** null means it started as soon as it was set. */
  startsOn: string | null;
  /** The last day it applies. */
  endsOn: string;
};

/** A percentage off renewals for members who paid without a break for some months. */
export type LoyaltyOffer = {
  months: number;
  percent: number;
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
  /** When the payment was recorded. Demo data leaves it out. */
  recordedAt?: string;
};

export type PlanInput = Pick<MembershipPlan, 'name' | 'priceCents' | 'durationDays'> & {
  offer: PlanOffer | null;
};

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
