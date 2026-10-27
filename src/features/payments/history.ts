import type { Membership, PaymentMethod } from '@/features/memberships/types';
import { paymentState } from '@/features/payments/rules';
import type { OnlinePayment } from '@/features/payments/types';

export const methodLabel: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  online: 'Paid in app',
  complimentary: 'Complimentary',
};

/** One line of a member's payment history. */
export type HistoryEntry =
  | {
      kind: 'recorded';
      id: string;
      membership: Membership;
      /** When it was paid: when it was recorded, else the day the membership started. */
      paidAt: string;
      /** The in-app payment behind it, whose receipt can be opened. */
      onlinePaymentId: string | null;
    }
  | { kind: 'pending'; id: string; payment: OnlinePayment };

function paidAt(membership: Membership) {
  return membership.recordedAt ?? `${membership.startsOn}T00:00:00`;
}

/**
 * Everything a member has paid at the gym, front desk and in the app, newest
 * first, with any in-app payment still on Razorpay's page at the top.
 */
export function memberHistory(
  memberId: string,
  memberships: Membership[],
  online: OnlinePayment[],
  now: Date = new Date(),
): HistoryEntry[] {
  const mine = online.filter((p) => p.memberId === memberId);
  const pending: HistoryEntry[] = mine
    .filter((p) => paymentState(p, now) === 'pending')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((payment) => ({ kind: 'pending', id: payment.id, payment }));
  const recorded: HistoryEntry[] = memberships
    .filter((m) => m.memberId === memberId)
    .map((membership) => ({
      kind: 'recorded' as const,
      id: membership.id,
      membership,
      paidAt: paidAt(membership),
      onlinePaymentId: mine.find((p) => p.membershipId === membership.id)?.id ?? null,
    }))
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  return [...pending, ...recorded];
}

/** A member's line in the staff payment history: how much, how often, how recently. */
export type MemberPayments = {
  memberId: string;
  memberName: string;
  payments: number;
  totalCents: number;
  currency: string;
  lastPaidAt: string;
  /** In-app payments still on Razorpay's page. */
  pending: number;
};

/** Every member who has paid, most recent payment first; anyone paying right now on top. */
export function paymentsByMember(
  memberships: Membership[],
  online: OnlinePayment[],
  now: Date = new Date(),
): MemberPayments[] {
  const byMember = new Map<string, MemberPayments>();
  for (const m of memberships) {
    const entry = byMember.get(m.memberId) ?? {
      memberId: m.memberId,
      memberName: m.memberName,
      payments: 0,
      totalCents: 0,
      currency: m.plan.currency,
      lastPaidAt: '',
      pending: 0,
    };
    entry.payments += 1;
    entry.totalCents += m.amountPaidCents ?? 0;
    const at = paidAt(m);
    if (at > entry.lastPaidAt) entry.lastPaidAt = at;
    byMember.set(m.memberId, entry);
  }
  for (const p of online) {
    if (paymentState(p, now) !== 'pending') continue;
    const entry = byMember.get(p.memberId) ?? {
      memberId: p.memberId,
      memberName: p.memberName,
      payments: 0,
      totalCents: 0,
      currency: p.currency,
      lastPaidAt: '',
      pending: 0,
    };
    entry.pending += 1;
    byMember.set(p.memberId, entry);
  }
  return [...byMember.values()].sort(
    (a, b) =>
      Number(b.pending > 0) - Number(a.pending > 0) ||
      b.lastPaidAt.localeCompare(a.lastPaidAt) ||
      a.memberName.localeCompare(b.memberName),
  );
}

/** Members whose name contains the search, ignoring case and extra spaces. */
export function searchMembers(list: MemberPayments[], query: string) {
  const q = query.trim().toLowerCase();
  return q ? list.filter((m) => m.memberName.toLowerCase().includes(q)) : list;
}
