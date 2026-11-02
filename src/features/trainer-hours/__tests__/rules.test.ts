import {
  applyRules,
  fromTime,
  monthStart,
  permissionProblem,
  rulesProblem,
  sortPermissions,
  summariseMonth,
  toTime,
} from '@/features/trainer-hours/rules';
import type { TrainerDay, TrainerHourRules, WorkPermission } from '@/features/trainer-hours/types';

const rules: TrainerHourRules = {
  requiredMinutes: 480,
  shortLimitMinutes: 120,
  lopMinutes: 240,
  offDays: [0],
  startsOn: '2026-10-01',
};

const day = (over: Partial<TrainerDay> = {}): TrainerDay => ({
  trainerId: 't1',
  fullName: 'Karthik',
  day: '2026-10-20',
  workedMinutes: 480,
  longestVisitMinutes: 480,
  permissionMinutes: 0,
  ...over,
});

describe('applyRules', () => {
  it('costs nothing for a full day', () => {
    expect(applyRules(day(), rules)).toMatchObject({ shortMinutes: 0, lopMinutes: 0 });
  });

  it('allows a shortfall up to the limit', () => {
    expect(applyRules(day({ workedMinutes: 360 }), rules).lopMinutes).toBe(0);
  });

  it('costs the LOP hours past the limit', () => {
    expect(applyRules(day({ workedMinutes: 359 }), rules)).toMatchObject({
      shortMinutes: 121,
      lopMinutes: 240,
      absent: false,
    });
  });

  it('counts approved permission as worked', () => {
    expect(applyRules(day({ workedMinutes: 300, permissionMinutes: 120 }), rules).lopMinutes).toBe(
      0,
    );
  });

  it('costs the full day when absent without permission', () => {
    expect(applyRules(day({ workedMinutes: 0 }), rules)).toMatchObject({
      lopMinutes: 480,
      absent: true,
    });
  });

  it('costs nothing for a full day of permission', () => {
    expect(applyRules(day({ workedMinutes: 0, permissionMinutes: 480 }), rules).lopMinutes).toBe(0);
  });

  it('charges any shortfall when the limit is 0', () => {
    expect(
      applyRules(day({ workedMinutes: 479 }), { ...rules, shortLimitMinutes: 0 }).lopMinutes,
    ).toBe(240);
  });
});

describe('summariseMonth', () => {
  it('adds up each trainer and lists most LOP first', () => {
    const months = summariseMonth(
      [
        day({ day: '2026-10-20' }),
        day({ day: '2026-10-21', workedMinutes: 200 }),
        day({ trainerId: 't2', fullName: 'Divya', day: '2026-10-21', workedMinutes: 0 }),
        day({ trainerId: 't2', fullName: 'Divya', day: '2026-10-20', workedMinutes: 300 }),
      ],
      rules,
    );
    expect(months.map((m) => [m.fullName, m.lopMinutes, m.workingDays])).toEqual([
      ['Divya', 720, 2],
      ['Karthik', 240, 2],
    ]);
    expect(months[0].lopDays.map((d) => d.day)).toEqual(['2026-10-20', '2026-10-21']);
    expect(months[1].workedMinutes).toBe(680);
  });
});

describe('rulesProblem', () => {
  it('needs the allowed shortfall below the hours', () => {
    expect(rulesProblem({ ...rules, shortLimitMinutes: 480 })).toMatch(/less than/);
    expect(rulesProblem(rules)).toBeNull();
  });

  it('needs a working day', () => {
    expect(rulesProblem({ ...rules, offDays: [0, 1, 2, 3, 4, 5, 6] })).toMatch(/working day/);
  });
});

describe('permissionProblem', () => {
  const input = {
    day: '2026-10-20',
    startsAt: 600,
    endsAt: 720,
    reason: 'medical' as const,
    note: '',
  };

  it('accepts a normal request', () => {
    expect(permissionProblem(input)).toBeNull();
  });

  it('needs the end after the start', () => {
    expect(permissionProblem({ ...input, endsAt: 600 })).toMatch(/after/);
  });

  it('needs a note for Other', () => {
    expect(permissionProblem({ ...input, reason: 'other' })).toMatch(/note/);
    expect(permissionProblem({ ...input, reason: 'other', note: 'Bank' })).toBeNull();
  });
});

describe('sortPermissions', () => {
  const p = (id: string, status: WorkPermission['status'], d: string): WorkPermission => ({
    id,
    trainerId: 't1',
    trainerName: 'K',
    day: d,
    startsAt: 600,
    endsAt: 660,
    reason: 'medical',
    note: null,
    status,
    createdAt: '',
  });

  it('puts waiting first, soonest first, then answered newest first', () => {
    const sorted = sortPermissions([
      p('a', 'approved', '2026-10-01'),
      p('b', 'pending', '2026-10-25'),
      p('c', 'rejected', '2026-10-10'),
      p('d', 'pending', '2026-10-22'),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(['d', 'b', 'c', 'a']);
  });
});

describe('times and months', () => {
  it('round-trips times', () => {
    expect(toTime(570)).toBe('09:30');
    expect(fromTime('09:30:00')).toBe(570);
  });

  it('finds month starts', () => {
    expect(monthStart(0, new Date(2026, 9, 31))).toBe('2026-10-01');
    expect(monthStart(10, new Date(2026, 9, 31))).toBe('2025-12-01');
  });
});
