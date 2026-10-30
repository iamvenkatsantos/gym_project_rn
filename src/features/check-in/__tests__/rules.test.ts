import { qrRows } from '@/features/check-in/components/qr-code';
import {
  autoOutHint,
  checkInLink,
  gymHours,
  hoursLine,
  minutesOfDay,
  parseCheckInLink,
  qrFileName,
  scanDetail,
  scanHeadline,
  timeOfDay,
} from '@/features/check-in/rules';

const gymId = '4f1c2d3e-0000-4000-8000-000000000001';

describe('check-in links', () => {
  it('round-trips a live code and a poster code', () => {
    for (const code of ['58753221.0a1b2c3d4e5f', 'f00dfeedbeef12345678']) {
      expect(parseCheckInLink(checkInLink({ gymId, code }))).toEqual({ gymId, code });
    }
  });

  it('accepts the triple-slash form and stray spaces', () => {
    expect(parseCheckInLink(` corefit:///check-in?code=abc&gym=${gymId} `)).toEqual({
      gymId,
      code: 'abc',
    });
  });

  it('rejects other QR codes', () => {
    expect(parseCheckInLink('https://example.com/check-in?gym=1&code=2')).toBeNull();
    expect(parseCheckInLink('corefit://payment-return')).toBeNull();
    expect(parseCheckInLink(`corefit://check-in?gym=${gymId}`)).toBeNull();
    expect(parseCheckInLink('corefit://check-in?gym=%E0%A4&code=x')).toBeNull();
  });
});

describe('scan messages', () => {
  const at = (h: number, m: number) => new Date(2026, 9, 27, h, m).toISOString();

  it('says how long they stayed when they check out', () => {
    const result = {
      action: 'out' as const,
      gymName: 'Pulse Velachery',
      checkedInAt: at(6, 0),
      checkedOutAt: at(7, 20),
    };
    expect(scanHeadline(result)).toBe('Checked out');
    expect(scanDetail(result)).toBe('Pulse Velachery · 1 h 20 min today. See you next time!');
  });

  it('explains a double scan', () => {
    const result = {
      action: 'already_in' as const,
      gymName: 'Pulse Velachery',
      checkedInAt: at(6, 0),
      checkedOutAt: null,
    };
    expect(scanHeadline(result)).toBe('You’re already checked in');
    expect(scanDetail(result)).toMatch(
      /^Pulse Velachery · in since .*Scan again when you leave\.$/,
    );
  });

  it('tells each role when auto check-out happens', () => {
    const rules = {
      qrOnly: false,
      memberAutoOutHours: 3,
      trainerAutoOutHours: 12,
      opensAt: null,
      closesAt: null,
    };
    expect(autoOutHint(rules, 'member')).toContain('automatically after 3 h.');
    expect(autoOutHint(rules, 'trainer')).toContain('after 12 h.');
    expect(autoOutHint({ ...rules, opensAt: '05:30', closesAt: '22:00' }, 'member')).toBe(
      'If you forget, you’re checked out at closing (10:00 pm) or after 3 h.',
    );
    expect(autoOutHint(undefined, 'member')).toBe('');
  });
});

describe('opening hours', () => {
  it('reads Postgres times', () => {
    expect(minutesOfDay('05:30:00')).toBe(330);
    expect(minutesOfDay('22:00')).toBe(1320);
    expect(minutesOfDay(null)).toBeNull();
  });

  it('shows times the same way on every phone', () => {
    expect(timeOfDay(0)).toBe('12:00 am');
    expect(timeOfDay(330)).toBe('5:30 am');
    expect(timeOfDay(720)).toBe('12:00 pm');
    expect(timeOfDay(1320)).toBe('10:00 pm');
  });

  it('says when the branch is open', () => {
    expect(hoursLine(gymHours({ opensAt: '05:30', closesAt: '22:00' }))).toBe(
      'Open 5:30 am – 10:00 pm',
    );
    expect(hoursLine(gymHours({ opensAt: '18:00', closesAt: '01:00' }))).toBe(
      'Open 6:00 pm – 1:00 am',
    );
    expect(hoursLine(gymHours({ opensAt: null, closesAt: null }))).toBe('Open 24 hours');
  });
});

describe('qrRows', () => {
  it('draws a square code with the three finder patterns', () => {
    const { size, rows } = qrRows(checkInLink({ gymId, code: '58753221.0a1b2c3d4e5f' }));
    expect(rows).toHaveLength(size);
    // The top row starts with the 7-module finder, and another ends it.
    expect(rows[0][0]).toEqual([0, 7]);
    expect(rows[0].at(-1)).toEqual([size - 7, 7]);
    expect(rows[size - 1][0]).toEqual([0, 7]);
  });
});

describe('qrFileName', () => {
  it('names the image after the branch', () => {
    expect(qrFileName('Pulse Fitness Velachery')).toBe('Pulse Fitness Velachery check-in QR.png');
    expect(qrFileName('A/B: Gym?')).toBe('AB Gym check-in QR.png');
    expect(qrFileName('///')).toBe('Branch check-in QR.png');
  });
});
