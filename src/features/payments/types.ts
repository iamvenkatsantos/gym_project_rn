/** What an online payment is doing, as the app shows it. */
export type OnlinePaymentStatus = 'created' | 'paid' | 'expired';

/** A membership paid in the app through Razorpay. */
export type OnlinePayment = {
  id: string;
  gymId: string;
  memberId: string;
  memberName: string;
  planId: string;
  planName: string;
  /** What the member paid, including any online payment charges. */
  amountCents: number;
  /** The plan's price, which the membership records. */
  baseCents: number;
  /** Razorpay's fees, when the branch passes them on to the member; else 0. */
  chargesCents: number;
  currency: string;
  status: OnlinePaymentStatus;
  /** Razorpay's payment page, while it's still open. */
  linkUrl: string | null;
  razorpayPaymentId: string | null;
  /** The membership it paid for, once paid. */
  membershipId: string | null;
  startsOn: string | null;
  endsOn: string | null;
  feeCents: number | null;
  /** CoreFit Gym's cut, kept from what the gym receives. */
  cutCents: number;
  /** What reached the owner's Razorpay account, once transferred. */
  transferCents: number | null;
  /** Set when the gym's share couldn't be sent to the owner's Razorpay account. */
  transferError: string | null;
  createdAt: string;
  paidAt: string | null;
};

/** What a member pays for a plan online, before they pay it. */
export type PaymentQuote = {
  baseCents: number;
  amountCents: number;
  chargesCents: number;
  gatewayFeeCents: number;
  transferFeeCents: number;
  currency: string;
};

export type StartedPayment = { paymentId: string; url: string };
