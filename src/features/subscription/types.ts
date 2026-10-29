/** What a branch pays CoreFit Gym each year, and how long it's paid for. */
export type Subscription = {
  /** The branch's yearly fee: its own or the default. */
  feeCents: number;
  /** The online payments add-on per year, when the branch has it on; else 0. */
  addonCents: number;
  /** What a year costs: fee + add-on. */
  amountCents: number;
  currency: string;
  /** The last day the plan covers (YYYY-MM-DD); null if never paid. */
  paidUntil: string | null;
  /** Today at the branch (YYYY-MM-DD). */
  today: string;
};

export type SubscriptionPaymentStatus = 'created' | 'paid' | 'expired';

/** A year paid for, or a payment page the owner opened. */
export type SubscriptionPayment = {
  id: string;
  gymId: string;
  /** online: through Razorpay; manual: recorded by the CoreFit Gym admin. */
  method: 'online' | 'manual';
  amountCents: number;
  currency: string;
  status: SubscriptionPaymentStatus;
  periodStart: string | null;
  periodEnd: string | null;
  note: string | null;
  createdAt: string;
  paidAt: string | null;
};

export type StartedSubscriptionPayment = { paymentId: string; url: string };

/** What everyone at a branch sees of its plan: paid, or the day the app stops. */
export type BranchAccess = {
  paid: boolean;
  /** The first day the app is locked, when unpaid. */
  locksOn: string | null;
  locked: boolean;
};
