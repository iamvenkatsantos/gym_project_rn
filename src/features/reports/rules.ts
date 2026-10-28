import { membershipStatus, toIsoDate } from '@/features/memberships/rules';
import type { PaymentMethod } from '@/features/memberships/types';
import type { CsvCell } from '@/features/reports/csv';
import type {
  AttendanceExportRow,
  MembershipExportRow,
  PaymentRow,
  ReportKind,
  ReportPeriod,
} from '@/features/reports/types';

export type PeriodPreset = 'thisMonth' | 'lastMonth' | 'last3Months' | 'financialYear';

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'last3Months', label: 'Last 3 months' },
  { value: 'financialYear', label: 'This financial year' },
];

/**
 * The days a preset covers, up to today. The financial year is India's,
 * April to March, which is how gyms file their accounts.
 */
export function presetPeriod(preset: PeriodPreset, today: Date = new Date()): ReportPeriod {
  const y = today.getFullYear();
  const m = today.getMonth();
  const to = toIsoDate(today);
  switch (preset) {
    case 'thisMonth':
      return { from: toIsoDate(new Date(y, m, 1)), to };
    case 'lastMonth':
      return { from: toIsoDate(new Date(y, m - 1, 1)), to: toIsoDate(new Date(y, m, 0)) };
    case 'last3Months':
      return { from: toIsoDate(new Date(y, m - 2, 1)), to };
    case 'financialYear':
      return { from: toIsoDate(new Date(m >= 3 ? y : y - 1, 3, 1)), to };
  }
}

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  online: 'Online',
  complimentary: 'Complimentary',
};

export const STATUS_LABELS = {
  active: 'Active',
  expiringSoon: 'Expiring soon',
  expired: 'Expired',
  upcoming: 'Starts later',
} as const;

/** Paise as plain rupees, "1499.00", so spreadsheets can add them up. */
function rupees(cents: number | null) {
  return cents === null ? null : (cents / 100).toFixed(2);
}

function method(value: PaymentMethod | null) {
  return value ? METHOD_LABELS[value] : '';
}

export function paymentsTable(rows: PaymentRow[]): [string[], CsvCell[][]] {
  return [
    [
      'Paid on',
      'Member',
      'Email',
      'Plan',
      'Amount',
      'Currency',
      'Method',
      'Starts',
      'Ends',
      'Recorded by',
      'Note',
    ],
    rows.map((r) => [
      r.paidOn,
      r.memberName,
      r.memberEmail,
      r.planName,
      rupees(r.amountPaidCents),
      r.currency,
      method(r.paymentMethod),
      r.startsOn,
      r.endsOn,
      r.recordedBy,
      r.note,
    ]),
  ];
}

export function membershipsTable(
  rows: MembershipExportRow[],
  today: Date = new Date(),
): [string[], CsvCell[][]] {
  return [
    [
      'Member',
      'Email',
      'Phone',
      'Joined',
      'Admitted by',
      'Admitted on',
      'Plan',
      'Starts',
      'Ends',
      'Status',
      'Last paid',
      'Currency',
      'Method',
    ],
    rows.map((r) => [
      r.memberName,
      r.memberEmail,
      r.phone,
      r.joinedOn,
      r.admittedBy,
      r.admittedOn,
      r.planName,
      r.startsOn,
      r.endsOn,
      r.startsOn && r.endsOn
        ? STATUS_LABELS[membershipStatus({ startsOn: r.startsOn, endsOn: r.endsOn }, today)]
        : 'No membership',
      rupees(r.amountPaidCents),
      r.currency,
      method(r.paymentMethod),
    ]),
  ];
}

export function attendanceTable(rows: AttendanceExportRow[]): [string[], CsvCell[][]] {
  return [
    ['Date', 'Name', 'Role', 'Checked in', 'Checked out', 'Minutes in gym', 'Workouts'],
    rows.map((r) => [
      r.day,
      r.fullName,
      r.role === 'trainer' ? 'Trainer' : 'Member',
      r.checkedIn,
      r.checkedOut,
      r.minutesInGym,
      r.workouts,
    ]),
  ];
}

/** "corefit-payments-2026-10-01-to-2026-10-26.csv", safe on every phone and computer. */
export function reportFileName(kind: ReportKind, period: ReportPeriod | null, today = new Date()) {
  const span = period ? `${period.from}-to-${period.to}` : toIsoDate(today);
  return `corefit-${kind}-${span}.csv`;
}
