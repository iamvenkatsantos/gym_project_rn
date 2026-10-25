import {
  attendanceStatus,
  attendanceTimes,
  canStartWorkout,
  countByRole,
  dayLabel,
  formatMinutes,
  minutesAtGym,
  sortForDay,
} from '@/features/attendance/rules';
import type { AttendanceDay, AttendanceEntry } from '@/features/attendance/types';

const entry = (
  userId: string,
  role: AttendanceEntry['role'],
  checkedInAt: string | null,
  checkedOutAt: string | null = null,
): AttendanceEntry => ({
  day: '2026-10-25',
  userId,
  fullName: userId,
  role,
  checkedInAt,
  checkedOutAt,
  workouts: 0,
});

const day = (checkedOutAt: string | null): AttendanceDay => ({
  day: '2026-10-25',
  role: 'member',
  checkedInAt: '2026-10-25T01:00:00Z',
  checkedOutAt,
  workouts: 0,
});

describe('attendance status', () => {
  it('is in the gym only between check-in and check-out', () => {
    expect(attendanceStatus(null)).toBe('notCheckedIn');
    expect(attendanceStatus(day(null))).toBe('inGym');
    expect(attendanceStatus(day('2026-10-25T02:00:00Z'))).toBe('left');
  });

  it('lets members start a workout only while checked in', () => {
    expect(canStartWorkout(undefined)).toBe(false);
    expect(canStartWorkout(day(null))).toBe(true);
    expect(canStartWorkout(day('2026-10-25T02:00:00Z'))).toBe(false);
  });

  it('describes times for absent, present and departed people', () => {
    expect(attendanceTimes({ checkedInAt: null, checkedOutAt: null })).toBe('Not checked in');
    expect(attendanceTimes(day(null))).toMatch(/^In since /);
    expect(attendanceTimes(day('2026-10-25T02:00:00Z'))).toContain(' – ');
  });
});

describe('durations', () => {
  it('formats minutes and hours', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(60)).toBe('1 h');
    expect(formatMinutes(80)).toBe('1 h 20 min');
  });

  it('counts time at the gym up to now while still checked in', () => {
    const now = new Date('2026-10-25T01:30:00Z');
    expect(minutesAtGym(day(null), now)).toBe(30);
    expect(minutesAtGym(day('2026-10-25T02:15:00Z'), now)).toBe(75);
    expect(minutesAtGym({ checkedInAt: null, checkedOutAt: null }, now)).toBe(0);
  });
});

describe('day lists', () => {
  const list = [
    entry('zed', 'member', null),
    entry('amy', 'member', null),
    entry('late', 'member', '2026-10-25T05:00:00Z', '2026-10-25T06:00:00Z'),
    entry('early', 'member', '2026-10-25T01:00:00Z'),
    entry('tom', 'trainer', '2026-10-25T00:30:00Z'),
    entry('div', 'trainer', null),
  ];

  it('counts who came and who is still in, by role', () => {
    expect(countByRole(list)).toEqual({
      member: { present: 2, total: 4, inGym: 1 },
      trainer: { present: 1, total: 2, inGym: 1 },
    });
  });

  it('puts arrivals first in order, then absent people by name', () => {
    expect(sortForDay(list.filter((e) => e.role === 'member')).map((e) => e.userId)).toEqual([
      'early',
      'late',
      'amy',
      'zed',
    ]);
  });

  it('labels today and yesterday by the phone calendar', () => {
    const now = new Date(2026, 9, 25, 10);
    expect(dayLabel('2026-10-25', now)).toBe('Today');
    expect(dayLabel('2026-10-24', now)).toBe('Yesterday');
    expect(dayLabel('2026-10-20', now)).not.toMatch(/Today|Yesterday/);
  });
});
