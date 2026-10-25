/** Who attendance is kept for. Owners and supervisors read it; they don't check in. */
export type AttendeeRole = 'member' | 'trainer';

/** Someone's day at the gym: checked in, and out once they leave. */
export type AttendanceDay = {
  /** The gym's calendar day, YYYY-MM-DD in its own time zone. */
  day: string;
  role: AttendeeRole;
  checkedInAt: string;
  checkedOutAt: string | null;
  /** Workouts finished that day (members). */
  workouts: number;
};

/** One person on a day's attendance list; absent people have no check-in. */
export type AttendanceEntry = {
  day: string;
  userId: string;
  fullName: string;
  role: AttendeeRole;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  workouts: number;
};

/** One person's line in the attendance report over a period. */
export type AttendanceSummary = {
  userId: string;
  fullName: string;
  role: AttendeeRole;
  daysPresent: number;
  minutesInGym: number;
  workouts: number;
  lastSeen: string | null;
};
