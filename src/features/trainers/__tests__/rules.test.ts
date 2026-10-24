import { initials, slotsForDay } from '@/features/trainers/rules';
import type { AvailabilityWindow } from '@/features/trainers/types';

// Monday 26 Oct 2026, local time.
const monday = new Date(2026, 9, 26);
const morning: AvailabilityWindow = { weekday: 1, startTime: '09:00', endTime: '12:00' };
const local = (hour: number, minute = 0) => new Date(2026, 9, 26, hour, minute).toISOString();

describe('slotsForDay', () => {
  it('splits each window into back-to-back sessions that fit inside it', () => {
    const slots = slotsForDay({
      day: monday,
      availability: [morning, { weekday: 1, startTime: '17:00', endTime: '18:30' }],
      sessionMinutes: 60,
      busy: [],
      now: new Date(2026, 9, 25),
    });
    expect(slots.map((s) => s.startsAt)).toEqual([local(9), local(10), local(11), local(17)]);
    expect(slots.every((s) => s.available)).toBe(true);
  });

  it('ignores windows for other weekdays', () => {
    const slots = slotsForDay({
      day: monday,
      availability: [{ ...morning, weekday: 2 }],
      sessionMinutes: 60,
      busy: [],
      now: new Date(2026, 9, 25),
    });
    expect(slots).toEqual([]);
  });

  it('marks past slots and slots that clash with a booking as unavailable', () => {
    const slots = slotsForDay({
      day: monday,
      availability: [morning],
      sessionMinutes: 60,
      busy: [{ startsAt: local(10, 30), endsAt: local(11, 30) }],
      now: new Date(2026, 9, 26, 9, 15),
    });
    expect(slots.map((s) => s.available)).toEqual([false, false, false]);

    const later = slotsForDay({
      day: monday,
      availability: [morning],
      sessionMinutes: 30,
      busy: [{ startsAt: local(10), endsAt: local(11) }],
      now: new Date(2026, 9, 26, 8),
    });
    expect(later.filter((s) => s.available).map((s) => s.startsAt)).toEqual([
      local(9),
      local(9, 30),
      local(11),
      local(11, 30),
    ]);
  });
});

describe('initials', () => {
  it('uses the first two names', () => {
    expect(initials('Tom Trainer')).toBe('TT');
    expect(initials('priya')).toBe('P');
    expect(initials('Anu Lakshmi Raj')).toBe('AL');
  });
});
