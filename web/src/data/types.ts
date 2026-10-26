import type { Role } from '@/features/auth/types';
import type { MembershipStatus } from '@/features/memberships/rules';
import type { Membership } from '@/features/memberships/types';

export type { Membership, MembershipStatus, Role };
export type {
  AttendanceExportRow,
  MembershipExportRow,
  PaymentRow,
  ReportPeriod,
} from '@/features/reports/types';

export type OwnedGym = { gymId: string; gymName: string };

export type PersonStatus = 'active' | 'invited' | 'suspended';

/** Anyone at the gym, as the owner sees them. */
export type GymPerson = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  status: PersonStatus;
  joinedAt: string;
};

export type AttendeeRole = 'member' | 'trainer';

/** Someone who should be counted on a day, whether or not they came. */
export type DayAttendance = {
  day: string;
  userId: string;
  fullName: string;
  role: AttendeeRole;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  workouts: number;
};

/** One person's attendance over a span of days. */
export type AttendanceSummary = {
  userId: string;
  fullName: string;
  role: AttendeeRole;
  daysPresent: number;
  minutesInGym: number;
  workouts: number;
  lastSeen: string | null;
};
