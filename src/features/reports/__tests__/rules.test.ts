import {
  attendanceTable,
  membershipsTable,
  paymentsTable,
  presetPeriod,
  reportFileName,
} from '@/features/reports/rules';

const today = new Date(2026, 9, 26);

describe('presetPeriod', () => {
  it.each([
    ['thisMonth', '2026-10-01', '2026-10-26'],
    ['lastMonth', '2026-09-01', '2026-09-30'],
    ['last3Months', '2026-08-01', '2026-10-26'],
    ['financialYear', '2026-04-01', '2026-10-26'],
  ] as const)('%s', (preset, from, to) => {
    expect(presetPeriod(preset, today)).toEqual({ from, to });
  });

  it('crosses the year in January', () => {
    const jan = new Date(2027, 0, 10);
    expect(presetPeriod('lastMonth', jan)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(presetPeriod('last3Months', jan)).toEqual({ from: '2026-11-01', to: '2027-01-10' });
    expect(presetPeriod('financialYear', jan)).toEqual({ from: '2026-04-01', to: '2027-01-10' });
  });
});

describe('tables', () => {
  it('writes payments in rupees with readable methods', () => {
    const [header, rows] = paymentsTable([
      {
        paidOn: '2026-10-02',
        memberName: 'Maya',
        memberEmail: null,
        planName: 'Monthly',
        amountPaidCents: 149900,
        currency: 'INR',
        paymentMethod: 'bank_transfer',
        startsOn: '2026-10-02',
        endsOn: '2026-10-31',
        recordedBy: 'Olivia',
        note: '',
      },
    ]);
    expect(header).toHaveLength(rows[0].length);
    expect(rows[0][4]).toBe('1499.00');
    expect(rows[0][6]).toBe('Bank transfer');
  });

  it('gives each member a status, or none if they never paid', () => {
    const base = {
      memberEmail: null,
      joinedOn: '2026-01-01',
      amountPaidCents: null,
      currency: 'INR',
      paymentMethod: null,
      phone: null,
      admittedBy: null,
      admittedOn: null,
    };
    const [header, rows] = membershipsTable(
      [
        {
          ...base,
          memberName: 'A',
          planName: 'Monthly',
          startsOn: '2026-10-01',
          endsOn: '2026-11-30',
        },
        {
          ...base,
          memberName: 'B',
          planName: 'Monthly',
          startsOn: '2026-09-01',
          endsOn: '2026-09-30',
        },
        { ...base, memberName: 'C', planName: null, startsOn: null, endsOn: null },
      ],
      today,
    );
    const status = header.indexOf('Status');
    expect(rows.map((r) => r[status])).toEqual(['Active', 'Expired', 'No membership']);
  });

  it('labels attendance roles', () => {
    const [, rows] = attendanceTable([
      {
        day: '2026-10-26',
        fullName: 'Tom',
        role: 'trainer',
        checkedIn: '06:00',
        checkedOut: '',
        minutesInGym: null,
        workouts: 0,
      },
    ]);
    expect(rows[0]).toEqual(['2026-10-26', 'Tom', 'Trainer', '06:00', '', null, 0]);
  });
});

describe('reportFileName', () => {
  it('names the period, or today for a snapshot', () => {
    expect(reportFileName('payments', { from: '2026-10-01', to: '2026-10-26' })).toBe(
      'corefit-payments-2026-10-01-to-2026-10-26.csv',
    );
    expect(reportFileName('memberships', null, today)).toBe('corefit-memberships-2026-10-26.csv');
  });
});
