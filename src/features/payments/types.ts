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
  amountCents: number;
  currency: string;
  status: OnlinePaymentStatus;
  /** Razorpay's payment page, while it's still open. */
  linkUrl: string | null;
  razorpayPaymentId: string | null;
  /** The membership it paid for, once paid. */
  startsOn: string | null;
  endsOn: string | null;
  feeCents: number | null;
  /** Set when the gym's share couldn't be sent to the owner's Razorpay account. */
  transferError: string | null;
  createdAt: string;
  paidAt: string | null;
};

export type StartedPayment = { paymentId: string; url: string };
