import {
  compactMoney,
  formatChange,
  hourLabel,
  hourRangeLabel,
  hourlyLoad,
  memberHealth,
  monthLabel,
  revenueSummary,
} from '@/features/insights/rules';
import type { MemberInsight, MonthRevenue } from '@/features/insights/types';

const today = new Date(2026, 9, 26);

function month(m: string, amountCents: number, newMembers = 0): MonthRevenue {
  return { month: m, amountCents, payments: amountCents > 0 ? 1 : 0, newMembers, currency: 'INR' };
}

function member(overrides: Partial<MemberInsight>): MemberInsight {
  return {
    userId: overrides.fullName ?? 'u',
    fullName: 'Someone',
    joinedOn: '2026-01-01',
    startsOn: '2026-10-01',
    endsOn: '2026-12-31',
    lastVisit: '2026-10-25',
    visitsLast30Days: 8,
    ...overrides,
  };
}

describe('compactMoney', () => {
  it('shortens rupees with thousands, lakhs and crores', () => {
    expect(compactMoney(95000, 'INR')).toBe('₹950');
    expect(compactMoney(450000, 'INR')).toBe('₹4.5k');
    expect(compactMoney(4520000, 'INR')).toBe('₹45k');
    expect(compactMoney(12000000, 'INR')).toBe('₹1.2L');
    expect(compactMoney(3400000000, 'INR')).toBe('₹3.4Cr');
  });
});

describe('revenueSummary', () => {
  it('compares this month with last month and averages the months before', () => {
    const summary = revenueSummary([
      month('2026-08-01', 100000),
      month('2026-09-01', 200000),
      month('2026-10-01', 230000, 3),
    ]);
    expect(summary.thisMonth?.newMembers).toBe(3);
    expect(summary.change).toBe(15);
    expect(summary.monthlyAverageCents).toBe(150000);
    expect(formatChange(15)).toBe('+15%');
    expect(formatChange(-8)).toBe('-8%');
  });

  it('has no change when last month took nothing', () => {
    const summary = revenueSummary([month('2026-09-01', 0), month('2026-10-01', 5000)]);
    expect(summary.change).toBeNull();
    expect(summary.monthlyAverageCents).toBeNull();
  });

  it('labels months', () => {
    expect(monthLabel('2026-10-01')).toBe('Oct');
    expect(monthLabel('2027-01-01')).toBe('Jan');
  });
});

describe('memberHealth', () => {
  it('sorts members into active, lapsed and no plan', () => {
    const health = memberHealth(
      [
        member({ fullName: 'Regular' }),
        member({ fullName: 'Ending', endsOn: '2026-10-29' }),
        member({ fullName: 'Lapsed', startsOn: '2026-07-01', endsOn: '2026-10-20' }),
        member({ fullName: 'Long gone', startsOn: '2026-01-01', endsOn: '2026-03-31' }),
        member({ fullName: 'New', startsOn: null, endsOn: null, lastVisit: null }),
      ],
      today,
    );
    expect(health).toMatchObject({ total: 5, active: 2, expiringSoon: 1, lapsed: 2, noPlan: 1 });
    expect(health.recentlyLapsed.map((m) => m.fullName)).toEqual(['Lapsed']);
    expect(health.visitsPerWeek).toBe(1.9);
  });

  it('lists active members who stopped coming, never-came first', () => {
    const health = memberHealth(
      [
        member({ fullName: 'Recent' }),
        member({ fullName: 'Away', lastVisit: '2026-10-05' }),
        member({ fullName: 'Never', lastVisit: null, startsOn: '2026-09-01' }),
        member({ fullName: 'Just joined', lastVisit: null, startsOn: '2026-10-20' }),
        member({ fullName: 'Starts later', lastVisit: null, startsOn: '2026-11-01' }),
      ],
      today,
    );
    expect(health.away.map((m) => m.fullName)).toEqual(['Never', 'Away']);
  });
});

describe('hourlyLoad', () => {
  it('finds the busiest hour and day and keeps the usual opening hours', () => {
    const load = hourlyLoad([
      { weekday: 1, hour: 6, checkIns: 4 },
      { weekday: 1, hour: 18, checkIns: 3 },
      { weekday: 3, hour: 18, checkIns: 5 },
      { weekday: 7, hour: 23, checkIns: 1 },
    ]);
    expect(load.total).toBe(13);
    expect(load.busiestHour).toBe(18);
    expect(load.busiestWeekday).toBe(1);
    expect(load.byHour[0].hour).toBe(5);
    expect(load.byHour.at(-1)?.hour).toBe(23);
    expect(load.byWeekday).toHaveLength(7);
  });

  it('has no busiest hour without check-ins', () => {
    const load = hourlyLoad([]);
    expect(load.busiestHour).toBeNull();
    expect(load.busiestWeekday).toBeNull();
    expect(load.byHour).toHaveLength(18);
  });

  it('labels hours', () => {
    expect(hourLabel(0)).toBe('12am');
    expect(hourLabel(12)).toBe('12pm');
    expect(hourLabel(18)).toBe('6pm');
    expect(hourRangeLabel(18)).toBe('6–7 PM');
    expect(hourRangeLabel(11)).toBe('11 AM–12 PM');
    expect(hourRangeLabel(23)).toBe('11 PM–12 AM');
  });
});
