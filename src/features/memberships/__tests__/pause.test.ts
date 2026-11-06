import {
  findCurrentPause,
  isPausedOn,
  membershipOn,
  pauseDaysLeft,
  pauseLength,
  unusedPauseDays,
} from '@/features/memberships/pause';
import { coversToday } from '@/features/memberships/rules';

const pause = { id: 'p-1', startsOn: '2026-11-10', endsOn: '2026-11-15' };

describe('pause rules', () => {
  it('counts both ends of a pause', () => {
    expect(pauseLength(pause)).toBe(6);
  });

  it('knows the paused days', () => {
    expect(isPausedOn([pause], '2026-11-09')).toBe(false);
    expect(isPausedOn([pause], '2026-11-10')).toBe(true);
    expect(isPausedOn([pause], '2026-11-15')).toBe(true);
    expect(isPausedOn(undefined, '2026-11-12')).toBe(false);
  });

  it('finds a running or upcoming pause, not a past one', () => {
    const memberships = [{ pauses: [pause] }];
    expect(findCurrentPause(memberships, '2026-11-01')).toEqual(pause);
    expect(findCurrentPause(memberships, '2026-11-15')).toEqual(pause);
    expect(findCurrentPause(memberships, '2026-11-16')).toBeNull();
  });

  it('subtracts days already paused from the gym limit', () => {
    expect(pauseDaysLeft({ pauses: [pause] }, 15)).toBe(9);
    expect(pauseDaysLeft({ pauses: [pause] }, 5)).toBe(0);
    expect(pauseDaysLeft({}, 15)).toBe(15);
  });

  it('gives back every day of a pause not started, and the rest of a running one', () => {
    expect(unusedPauseDays(pause, '2026-11-08')).toBe(6);
    expect(unusedPauseDays(pause, '2026-11-10')).toBe(6);
    expect(unusedPauseDays(pause, '2026-11-13')).toBe(3);
  });

  it('picks the membership covering a day', () => {
    const a = { startsOn: '2026-11-01', endsOn: '2026-11-30' };
    const b = { startsOn: '2026-12-01', endsOn: '2026-12-30' };
    expect(membershipOn([a, b], '2026-12-05')).toBe(b);
    expect(membershipOn([a, b], '2027-01-05')).toBeNull();
  });

  it('a paused day is not covered', () => {
    const m = { startsOn: '2026-11-01', endsOn: '2026-12-06', pauses: [pause] };
    expect(coversToday(m, new Date(2026, 10, 12))).toBe(false);
    expect(coversToday(m, new Date(2026, 10, 16))).toBe(true);
  });
});
