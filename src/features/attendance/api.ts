import type {
  AttendanceDay,
  AttendanceEntry,
  AttendanceSummary,
  AttendeeRole,
} from '@/features/attendance/types';
import { delay, forGym, mockAttendance, mockDay, mockPeople } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type DayRow = {
  day: string;
  role: AttendeeRole;
  checked_in_at: string;
  checked_out_at: string | null;
  workouts: number;
};

function toDay(row: DayRow): AttendanceDay {
  return {
    day: row.day,
    role: row.role,
    checkedInAt: row.checked_in_at,
    checkedOutAt: row.checked_out_at,
    workouts: row.workouts,
  };
}

function mockAttendees(gymId: string) {
  return forGym(gymId, mockPeople).filter(
    (p): p is typeof p & { role: AttendeeRole } =>
      p.status === 'active' && (p.role === 'member' || p.role === 'trainer'),
  );
}

/** The signed-in person's attendance today at the gym, or null before they check in. */
export async function getMyAttendance(
  gymId: string,
  userId: string,
): Promise<AttendanceDay | null> {
  if (!supabase) {
    const today = forGym(gymId, mockAttendance).find(
      (a) => a.userId === userId && a.day === mockDay(),
    );
    return delay(today ?? null);
  }
  const rows = unwrap(await supabase.rpc('my_attendance', { p_gym_id: gymId })) as DayRow[];
  return rows[0] ? toDay(rows[0]) : null;
}

/** Checks in, or back in after a break; the first check-in time of the day is kept. */
export async function checkIn(gymId: string, userId: string, role: AttendeeRole) {
  if (!supabase) {
    const today = mockAttendance.find((a) => a.userId === userId && a.day === mockDay());
    if (today) today.checkedOutAt = null;
    else
      mockAttendance.push({
        userId,
        day: mockDay(),
        role,
        checkedInAt: new Date().toISOString(),
        checkedOutAt: null,
        workouts: 0,
      });
    return delay(undefined);
  }
  const { error } = await supabase.rpc('check_in', { p_gym_id: gymId });
  if (error) throw error;
}

export async function checkOut(gymId: string, userId: string) {
  if (!supabase) {
    const today = mockAttendance.find((a) => a.userId === userId && a.day === mockDay());
    if (!today || today.checkedOutAt) throw new Error('Check in first');
    today.checkedOutAt = new Date().toISOString();
    return delay(undefined);
  }
  const { error } = await supabase.rpc('check_out', { p_gym_id: gymId });
  if (error) throw error;
}

/**
 * Tells the member's trainers their workout started. The server refuses it
 * unless they're checked in, which is what keeps Start workout honest.
 */
export async function announceWorkoutStart(
  gymId: string,
  workout: { clientId: string; title: string },
) {
  if (!supabase) return delay(undefined, 0);
  const { error } = await supabase.rpc('start_workout_attendance', {
    p_gym_id: gymId,
    p_client_id: workout.clientId,
    p_title: workout.title,
  });
  if (error) throw error;
}

type EntryRow = {
  day: string;
  user_id: string;
  full_name: string;
  role: AttendeeRole;
  checked_in_at: string | null;
  checked_out_at: string | null;
  workouts: number;
};

/** Everyone who should be counted on a day, present or not. Owners and supervisors only. */
export async function listDayAttendance(
  gymId: string,
  daysAgo: number,
): Promise<AttendanceEntry[]> {
  if (!supabase) {
    const day = mockDay(daysAgo);
    return delay(
      mockAttendees(gymId).map((p) => {
        const a = mockAttendance.find((v) => v.userId === p.id && v.day === day);
        return {
          day,
          userId: p.id,
          fullName: p.fullName,
          role: p.role,
          checkedInAt: a?.checkedInAt ?? null,
          checkedOutAt: a?.checkedOutAt ?? null,
          workouts: a?.workouts ?? 0,
        };
      }),
    );
  }
  const rows = unwrap(
    await supabase.rpc('gym_attendance', { p_gym_id: gymId, p_days_ago: daysAgo }),
  ) as EntryRow[];
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
  role: AttendeeRole;
  days_present: number;
  minutes_in_gym: number;
  workouts: number;
  last_seen: string | null;
};

/** Days present, time in the gym and workouts per person over the last `days` days. */
export async function getAttendanceReport(
  gymId: string,
  days: number,
): Promise<AttendanceSummary[]> {
  if (!supabase) {
    const period = new Set(Array.from({ length: days }, (_, i) => mockDay(i)));
    return delay(
      mockAttendees(gymId)
        .map((p) => {
          const visits = mockAttendance.filter((a) => a.userId === p.id && period.has(a.day));
          return {
            userId: p.id,
            fullName: p.fullName,
            role: p.role,
            daysPresent: visits.length,
            minutesInGym: Math.round(
              visits.reduce(
                (sum, v) =>
                  v.checkedOutAt
                    ? sum + (Date.parse(v.checkedOutAt) - Date.parse(v.checkedInAt)) / 60000
                    : sum,
                0,
              ),
            ),
            workouts: visits.reduce((sum, v) => sum + v.workouts, 0),
            lastSeen:
              visits
                .map((v) => v.day)
                .sort()
                .at(-1) ?? null,
          };
        })
        .sort((a, b) => b.daysPresent - a.daysPresent || a.fullName.localeCompare(b.fullName)),
    );
  }
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
