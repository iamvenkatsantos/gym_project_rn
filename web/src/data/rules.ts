import { latestByMember, membershipStatus, toIsoDate } from '@/features/memberships/rules';
import { METHOD_LABELS } from '@/features/reports/rules';

import type { GymPerson, Membership, MembershipStatus, PaymentRow, PersonStatus } from './types';

export type MemberStanding = MembershipStatus | 'none';

/** A member with their latest membership, one row of the Members table. */
export type MemberRow = {
  id: string;
  fullName: string;
  email: string;
  status: PersonStatus;
  joinedAt: string;
  latest: Membership | null;
  standing: MemberStanding;
};

/** Members only (not staff), each with the membership that decides their standing today. */
export function memberRows(
  people: GymPerson[],
  memberships: Membership[],
  today: Date = new Date(),
): MemberRow[] {
  const latest = latestByMember(memberships);
  return people
    .filter((p) => p.role === 'member')
    .map((p) => {
      const m = latest.get(p.id) ?? null;
      return {
        id: p.id,
        fullName: p.fullName,
        email: p.email,
        status: p.status,
        joinedAt: p.joinedAt,
        latest: m,
        standing: m ? membershipStatus(m, today) : 'none',
      };
    });
}

export type StandingCounts = Record<MemberStanding, number>;

/** How many active members are in each standing. Suspended and invited people don't count. */
export function standingCounts(rows: MemberRow[]): StandingCounts {
  const counts: StandingCounts = { active: 0, expiringSoon: 0, expired: 0, upcoming: 0, none: 0 };
  for (const r of rows) if (r.status === 'active') counts[r.standing] += 1;
  return counts;
}

export type MethodTotal = { label: string; cents: number; count: number };

export type PaymentSummary = {
  totalCents: number;
  count: number;
  currency: string;
  byMethod: MethodTotal[];
};

/** Totals for a list of payments, biggest payment method first. */
export function summarizePayments(rows: PaymentRow[]): PaymentSummary {
  const byMethod = new Map<string, MethodTotal>();
  let totalCents = 0;
  for (const r of rows) {
    const cents = r.amountPaidCents ?? 0;
    totalCents += cents;
    const label = r.paymentMethod ? METHOD_LABELS[r.paymentMethod] : 'Not recorded';
    const entry = byMethod.get(label) ?? { label, cents: 0, count: 0 };
    entry.cents += cents;
    entry.count += 1;
    byMethod.set(label, entry);
  }
  return {
    totalCents,
    count: rows.length,
    currency: rows[0]?.currency ?? 'INR',
    byMethod: [...byMethod.values()].sort((a, b) => b.cents - a.cents),
  };
}

/** Whole calendar days from `isoDate` back to today; 0 for today, never negative. */
export function daysAgo(isoDate: string, today: Date = new Date()) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const then = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(Math.round((now - then) / 86_400_000), 0);
}

/** The same day last month, for comparing month-to-date revenue. */
export function lastMonthToDate(today: Date = new Date()) {
  const y = today.getFullYear();
  const m = today.getMonth();
  const lastDay = new Date(y, m, 0).getDate();
  return {
    from: toIsoDate(new Date(y, m - 1, 1)),
    to: toIsoDate(new Date(y, m - 1, Math.min(today.getDate(), lastDay))),
  };
}

/** Case-insensitive match on name or email. */
export function matchesSearch(row: { fullName: string; email: string }, query: string) {
  const q = query.trim().toLowerCase();
  return !q || row.fullName.toLowerCase().includes(q) || row.email.toLowerCase().includes(q);
}
