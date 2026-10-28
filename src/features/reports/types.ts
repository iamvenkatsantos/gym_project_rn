import type { PaymentMethod } from '@/features/memberships/types';

/** The reports an owner can export. */
export type ReportKind = 'payments' | 'memberships' | 'attendance';

/** A span of gym days, both ends included, as YYYY-MM-DD. */
export type ReportPeriod = { from: string; to: string };

/** One payment recorded at the front desk. */
export type PaymentRow = {
  paidOn: string;
  memberName: string;
  memberEmail: string | null;
  planName: string;
  amountPaidCents: number | null;
  currency: string;
  paymentMethod: PaymentMethod | null;
  startsOn: string;
  endsOn: string;
  recordedBy: string;
  note: string;
};

/** An active member and their latest membership, if they ever had one. */
export type MembershipExportRow = {
  memberName: string;
  memberEmail: string | null;
  joinedOn: string | null;
  planName: string | null;
  startsOn: string | null;
  endsOn: string | null;
  amountPaidCents: number | null;
  currency: string | null;
  paymentMethod: PaymentMethod | null;
  phone: string | null;
  /** Who invited them: their admission. Null for members from before admissions were kept. */
  admittedBy: string | null;
  admittedOn: string | null;
};

/** One person's check-in on one day. Times are the gym's local HH:MM. */
export type AttendanceExportRow = {
  day: string;
  fullName: string;
  role: 'member' | 'trainer';
  checkedIn: string;
  checkedOut: string;
  minutesInGym: number | null;
  workouts: number;
};
