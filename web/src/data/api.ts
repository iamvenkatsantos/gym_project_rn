import type {
  AttendanceExportRow,
  AttendanceSummary,
  DayAttendance,
  GymPerson,
  Membership,
  MembershipExportRow,
  OwnedGym,
  PaymentRow,
  ReportPeriod,
  Role,
} from './types';
import { supabase, unwrap } from '../lib/supabase';

// Every read goes through the same RLS and owner-checked RPCs the mobile app
// uses, so the dashboard can't see anything the owner couldn't see on a phone.

type GymRoleRow = { role: Role; status: string; gym: { id: string; name: string } };

/** The gyms the signed-in user owns. The dashboard is for owners only. */
export async function fetchOwnedGyms(userId: string): Promise<OwnedGym[]> {
  const rows = unwrap(
    await supabase
      .from('gym_members')
      .select('role, status, gym:gyms(id, name)')
      .eq('user_id', userId),
  ) as unknown as GymRoleRow[];
  return rows
    .filter((r) => r.role === 'owner' && r.status === 'active')
    .map((r) => ({ gymId: r.gym.id, gymName: r.gym.name }))
    .sort((a, b) => a.gymName.localeCompare(b.gymName));
}

type PersonRow = {
  user_id: string;
  full_name: string;
  email: string;
  role: Role;
  status: GymPerson['status'];
  joined_at: string;
};

export async function listPeople(gymId: string): Promise<GymPerson[]> {
  const rows = unwrap(await supabase.rpc('gym_people', { p_gym_id: gymId })) as PersonRow[];
  return rows.map((r) => ({
    id: r.user_id,
    fullName: r.full_name,
    email: r.email,
    role: r.role,
    status: r.status,
    joinedAt: r.joined_at,
  }));
}

type PlanRow = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  duration_days: number;
};

type MembershipRow = {
  id: string;
  member_id: string;
  starts_on: string;
  ends_on: string;
  amount_paid_cents: number | null;
  payment_method: Membership['paymentMethod'];
  member: { full_name: string };
  plan: PlanRow;
};

// Same shape as the mobile app's listMemberships; the inner join filters by the plan's gym.
const MEMBERSHIP_COLUMNS =
  'id, member_id, starts_on, ends_on, amount_paid_cents, payment_method, member:profiles!memberships_member_id_fkey(full_name), plan:membership_plans!inner(id, name, price_cents, currency, duration_days)';

export async function listMemberships(gymId: string): Promise<Membership[]> {
  const rows = unwrap(
    await supabase
      .from('memberships')
      .select(MEMBERSHIP_COLUMNS)
      .eq('plan.gym_id', gymId)
      .order('ends_on'),
  ) as unknown as MembershipRow[];
  return rows.map((r) => ({
    id: r.id,
    memberId: r.member_id,
    memberName: r.member.full_name,
    plan: {
      id: r.plan.id,
      name: r.plan.name,
      priceCents: r.plan.price_cents,
      currency: r.plan.currency,
      durationDays: r.plan.duration_days,
    },
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    amountPaidCents: r.amount_paid_cents,
    paymentMethod: r.payment_method,
    phone: r.phone,
    admittedBy: r.admitted_by,
    admittedOn: r.admitted_on,
  }));
}

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

/** Payments recorded in the period. Owner only; the RPC refuses anyone else. */
export async function listPayments(gymId: string, period: ReportPeriod): Promise<PaymentRow[]> {
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

type MembershipExportDbRow = {
  member_name: string;
  member_email: string | null;
  joined_on: string | null;
  plan_name: string | null;
  starts_on: string | null;
  ends_on: string | null;
  amount_paid_cents: number | null;
  currency: string | null;
  payment_method: MembershipExportRow['paymentMethod'];
  phone: string | null;
  admitted_by: string | null;
  admitted_on: string | null;
};

export async function exportMemberships(gymId: string): Promise<MembershipExportRow[]> {
  const rows = unwrap(
    await supabase.rpc('export_memberships', { p_gym_id: gymId }),
  ) as MembershipExportDbRow[];
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

type AttendanceExportDbRow = {
  day: string;
  full_name: string;
  role: AttendanceExportRow['role'];
  checked_in: string;
  checked_out: string;
  minutes_in_gym: number | null;
  workouts: number;
};

export async function exportAttendance(
  gymId: string,
  period: ReportPeriod,
): Promise<AttendanceExportRow[]> {
  const rows = unwrap(
    await supabase.rpc('export_attendance', {
      p_gym_id: gymId,
      p_from: period.from,
      p_to: period.to,
    }),
  ) as AttendanceExportDbRow[];
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

type DayRow = {
  day: string;
  user_id: string;
  full_name: string;
  role: DayAttendance['role'];
  checked_in_at: string | null;
  checked_out_at: string | null;
  workouts: number;
};

/** Every active member and trainer on a gym day, present or not. 0 is today. */
export async function listDayAttendance(gymId: string, daysAgo: number): Promise<DayAttendance[]> {
  const rows = unwrap(
    await supabase.rpc('gym_attendance', { p_gym_id: gymId, p_days_ago: daysAgo }),
  ) as DayRow[];
  return rows.map((r) => ({
    day: r.day,
    userId: r.user_id,
    fullName: r.full_name,
    role: r.role,
    checkedInAt: r.checked_in_at,
    checkedOutAt: r.checked_out_at,
    workouts: r.workouts,
  }));
}

type SummaryRow = {
  user_id: string;
  full_name: string;
  role: AttendanceSummary['role'];
  days_present: number;
  minutes_in_gym: number;
  workouts: number;
  last_seen: string | null;
};

/** Days present, time in the gym and workouts per person over the last `days` days. */
export async function attendanceReport(gymId: string, days: number): Promise<AttendanceSummary[]> {
  const rows = unwrap(
    await supabase.rpc('attendance_report', { p_gym_id: gymId, p_days: days }),
  ) as SummaryRow[];
  return rows.map((r) => ({
    userId: r.user_id,
    fullName: r.full_name,
    role: r.role,
    daysPresent: r.days_present,
    minutesInGym: r.minutes_in_gym,
    workouts: r.workouts,
    lastSeen: r.last_seen,
  }));
}
