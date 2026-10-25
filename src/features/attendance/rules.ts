import type { AttendanceDay, AttendanceEntry, AttendeeRole } from '@/features/attendance/types';

export type AttendanceStatus = 'notCheckedIn' | 'inGym' | 'left';

export function attendanceStatus(
  entry: (Pick<AttendanceDay, 'checkedOutAt'> & { checkedInAt: string | null }) | null | undefined,
): AttendanceStatus {
  if (!entry?.checkedInAt) return 'notCheckedIn';
  return entry.checkedOutAt ? 'left' : 'inGym';
}

/** Members can only start a workout while they're checked in. */
export function canStartWorkout(today: AttendanceDay | null | undefined) {
  return attendanceStatus(today) === 'inGym';
}

/** "6:05 PM" */
export function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "45 min", "1 h 20 min" */
export function formatMinutes(minutes: number) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

/** Minutes between check-in and check-out, or up to now while still in the gym. */
export function minutesAtGym(
  entry: { checkedInAt: string | null; checkedOutAt: string | null },
  now = new Date(),
) {
  if (!entry.checkedInAt) return 0;
  const end = entry.checkedOutAt ? new Date(entry.checkedOutAt) : now;
  return Math.max(0, (end.getTime() - new Date(entry.checkedInAt).getTime()) / 60000);
}

/** "6:05 PM – 7:10 PM", "In since 6:05 PM", or "Not checked in". */
export function attendanceTimes(entry: {
  checkedInAt: string | null;
  checkedOutAt: string | null;
}) {
  if (!entry.checkedInAt) return 'Not checked in';
  if (!entry.checkedOutAt) return `In since ${clockTime(entry.checkedInAt)}`;
  return `${clockTime(entry.checkedInAt)} – ${clockTime(entry.checkedOutAt)}`;
}

export type DayCount = { present: number; total: number; inGym: number };

/** Headcounts for a day's list, by role. */
export function countByRole(entries: AttendanceEntry[]): Record<AttendeeRole, DayCount> {
  const counts = {
    member: { present: 0, total: 0, inGym: 0 },
    trainer: { present: 0, total: 0, inGym: 0 },
  };
  for (const e of entries) {
    const c = counts[e.role];
    c.total += 1;
    if (e.checkedInAt) c.present += 1;
    if (attendanceStatus(e) === 'inGym') c.inGym += 1;
  }
  return counts;
}

/** Present first (earliest arrival first), then absent people by name. */
export function sortForDay(entries: AttendanceEntry[]) {
  return [...entries].sort((a, b) => {
    if (a.checkedInAt && b.checkedInAt) return a.checkedInAt.localeCompare(b.checkedInAt);
    if (a.checkedInAt) return -1;
    if (b.checkedInAt) return 1;
    return a.fullName.localeCompare(b.fullName);
  });
}

function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** "Today", "Yesterday" or "Sat 24 Oct" for a YYYY-MM-DD gym day, from the phone's calendar. */
export function dayLabel(day: string, now = new Date()) {
  if (day === localDay(now)) return 'Today';
  if (day === localDay(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return 'Yesterday';
  // Noon, so the label is the same calendar day in any time zone.
  return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
