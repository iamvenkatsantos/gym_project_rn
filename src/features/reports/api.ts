import { toIsoDate } from '@/features/memberships/rules';
import type {
  AttendanceExportRow,
  MembershipExportRow,
  PaymentRow,
  ReportPeriod,
} from '@/features/reports/types';
import { delay, forGym, mockAttendance, mockMemberships, mockPeople } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

// The export functions refuse anyone but the gym's owner, whatever the app shows.

type PaymentDbRow = {
  paid_on: string;
  member_name: string;
  member_email: string | null;
  plan_name: string;
  amount_paid_cents: number | null;
  currency: string;
  payment_method: PaymentRow['paymentMethod'];
  starts_on: string;
  ends_on: string;
  recorded_by: string;
  note: string;
};

export async function exportPayments(gymId: string, period: ReportPeriod): Promise<PaymentRow[]> {
  if (!supabase) {
    // Demo payments count as paid the day they started.
    return delay(
      forGym(gymId, mockMemberships)
        .filter((m) => m.startsOn >= period.from && m.startsOn <= period.to)
        .map((m) => ({
          paidOn: m.startsOn,
          memberName: m.memberName,
          memberEmail: mockPeople.find((p) => p.id === m.memberId)?.email ?? null,
          planName: m.plan.name,
          amountPaidCents: m.amountPaidCents ?? m.plan.priceCents,
          currency: m.plan.currency,
          paymentMethod: m.paymentMethod ?? 'upi',
          startsOn: m.startsOn,
          endsOn: m.endsOn,
          recordedBy: 'Olivia Owner',
          note: '',
        })),
    );
  }
  const rows = unwrap(
    await supabase.rpc('export_payments', {
      p_gym_id: gymId,
      p_from: period.from,
      p_to: period.to,
    }),
  ) as PaymentDbRow[];
  return rows.map((r) => ({
    paidOn: r.paid_on,
    memberName: r.member_name,
    memberEmail: r.member_email,
    planName: r.plan_name,
    amountPaidCents: r.amount_paid_cents,
    currency: r.currency,
    paymentMethod: r.payment_method,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    recordedBy: r.recorded_by,
    note: r.note,
  }));
}

type MembershipDbRow = {
  member_name: string;
  member_email: string | null;
  joined_on: string | null;
  plan_name: string | null;
  starts_on: string | null;
  ends_on: string | null;
  amount_paid_cents: number | null;
  currency: string | null;
  payment_method: MembershipExportRow['paymentMethod'];
};

export async function exportMemberships(gymId: string): Promise<MembershipExportRow[]> {
  if (!supabase) {
    return delay(
      forGym(gymId, mockPeople)
        .filter((p) => p.role === 'member' && p.status === 'active')
        .map((p) => {
          const m = mockMemberships
            .filter((v) => v.memberId === p.id)
            .sort((a, b) => b.endsOn.localeCompare(a.endsOn))[0];
          return {
            memberName: p.fullName,
            memberEmail: p.email,
            joinedOn: toIsoDate(new Date(p.joinedAt)),
            planName: m?.plan.name ?? null,
            startsOn: m?.startsOn ?? null,
            endsOn: m?.endsOn ?? null,
            amountPaidCents: m ? (m.amountPaidCents ?? m.plan.priceCents) : null,
            currency: m?.plan.currency ?? null,
            paymentMethod: m ? (m.paymentMethod ?? 'upi') : null,
          };
        }),
    );
  }
  const rows = unwrap(
    await supabase.rpc('export_memberships', { p_gym_id: gymId }),
  ) as MembershipDbRow[];
  return rows.map((r) => ({
    memberName: r.member_name,
    memberEmail: r.member_email,
    joinedOn: r.joined_on,
    planName: r.plan_name,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    amountPaidCents: r.amount_paid_cents,
    currency: r.currency,
    paymentMethod: r.payment_method,
  }));
}

type AttendanceDbRow = {
  day: string;
  full_name: string;
  role: AttendanceExportRow['role'];
  checked_in: string;
  checked_out: string;
  minutes_in_gym: number | null;
  workouts: number;
};

function hhmm(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export async function exportAttendance(
  gymId: string,
  period: ReportPeriod,
): Promise<AttendanceExportRow[]> {
  if (!supabase) {
    return delay(
      forGym(gymId, mockAttendance)
        .filter((a) => a.day >= period.from && a.day <= period.to)
        .sort((a, b) => a.day.localeCompare(b.day) || a.checkedInAt.localeCompare(b.checkedInAt))
        .map((a) => ({
          day: a.day,
          fullName: mockPeople.find((p) => p.id === a.userId)?.fullName ?? '',
          role: a.role,
          checkedIn: hhmm(a.checkedInAt),
          checkedOut: a.checkedOutAt ? hhmm(a.checkedOutAt) : '',
          minutesInGym: a.checkedOutAt
            ? Math.round((Date.parse(a.checkedOutAt) - Date.parse(a.checkedInAt)) / 60000)
            : null,
          workouts: a.workouts,
        })),
    );
  }
  const rows = unwrap(
    await supabase.rpc('export_attendance', {
      p_gym_id: gymId,
      p_from: period.from,
      p_to: period.to,
    }),
  ) as AttendanceDbRow[];
  return rows.map((r) => ({
    day: r.day,
    fullName: r.full_name,
    role: r.role,
    checkedIn: r.checked_in,
    checkedOut: r.checked_out,
    minutesInGym: r.minutes_in_gym,
    workouts: r.workouts,
  }));
}
