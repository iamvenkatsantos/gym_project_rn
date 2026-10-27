import { qrRows } from '@/features/check-in/components/qr-code';
import {
  autoOutHint,
  checkInLink,
  parseCheckInLink,
  scanDetail,
  scanHeadline,
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
    const rules = { qrOnly: false, memberAutoOutHours: 3, trainerAutoOutHours: 12 };
    expect(autoOutHint(rules, 'member')).toContain('after 3 h.');
    expect(autoOutHint(rules, 'trainer')).toContain('after 12 h.');
    expect(autoOutHint(undefined, 'member')).toBe('');
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
