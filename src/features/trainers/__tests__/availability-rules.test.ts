import {
  addWindow,
  availabilityProblem,
  copyToWeekdays,
  fromMinutes,
  removeWindow,
  updateWindow,
  weeklyHours,
  windowsForDay,
} from '@/features/trainers/availability-rules';
import type { AvailabilityWindow } from '@/features/trainers/types';

const monday = (startTime: string, endTime: string): AvailabilityWindow => ({
  weekday: 1,
  startTime,
  endTime,
});

describe('availability rules', () => {
  it('starts an empty day at 07:00–11:00 and adds later windows after the last one', () => {
    const one = addWindow([], 1);
    expect(one).toEqual([monday('07:00', '11:00')]);
    expect(windowsForDay(addWindow(one, 1), 1)).toEqual([
      monday('07:00', '11:00'),
      monday('12:00', '14:00'),
    ]);
  });

  it("doesn't add a window that would run past 23:30", () => {
    const late = [monday('20:00', '23:00')];
    expect(addWindow(late, 1)).toBe(late);
    expect(windowsForDay(addWindow([monday('20:00', '22:00')], 1), 1)[1]).toEqual(
      monday('23:00', '23:30'),
    );
  });

  it('formats and clamps times', () => {
    expect(fromMinutes(7 * 60 + 30)).toBe('07:30');
    expect(fromMinutes(-30)).toBe('00:00');
    expect(fromMinutes(24 * 60)).toBe('23:30');
  });

  it('updates and removes the given window only', () => {
    const a = monday('07:00', '09:00');
    const b = monday('17:00', '19:00');
    expect(updateWindow([a, b], b, { endTime: '20:00' })).toEqual([a, monday('17:00', '20:00')]);
    expect(removeWindow([a, b], a)).toEqual([b]);
  });

  it('copies a day to Monday–Saturday, replacing those days but keeping Sunday', () => {
    const sunday = { weekday: 0, startTime: '08:00', endTime: '10:00' };
    const tuesday = { weekday: 2, startTime: '12:00', endTime: '13:00' };
    const result = copyToWeekdays([monday('07:00', '11:00'), tuesday, sunday], 1);
    expect(result).toHaveLength(7);
    expect(windowsForDay(result, 2)).toEqual([{ ...monday('07:00', '11:00'), weekday: 2 }]);
    expect(windowsForDay(result, 0)).toEqual([sunday]);
  });

  it('reports windows that overlap or end before they start', () => {
    expect(availabilityProblem([monday('07:00', '11:00'), monday('11:00', '12:00')])).toBeNull();
    expect(availabilityProblem([monday('07:00', '11:00'), monday('10:30', '12:00')])).toBe(
      'Monday: 07:00–11:00 overlaps 10:30–12:00.',
    );
    expect(availabilityProblem([monday('11:00', '10:00')])).toBe(
      'Monday: 11:00 to 10:00 ends before it starts.',
    );
  });

  it('adds up weekly hours', () => {
    expect(weeklyHours([monday('07:00', '11:00'), monday('17:00', '18:30')])).toBe(5.5);
  });
});
