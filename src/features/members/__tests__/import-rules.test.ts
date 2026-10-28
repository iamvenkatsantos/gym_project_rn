import {
  importTemplate,
  isSpreadsheetFile,
  joinMessage,
  parseCsv,
  parseDate,
  parseMobile,
  previewImport,
} from '@/features/members/import-rules';
import type { MembershipPlan } from '@/features/memberships/types';

const plans: MembershipPlan[] = [
  { id: 'p-1', name: 'Monthly', priceCents: 150000, currency: 'INR', durationDays: 30 },
  { id: 'p-2', name: 'Quarterly', priceCents: 400000, currency: 'INR', durationDays: 90 },
];

const HEADER = 'Name,Email,Mobile,Plan,Start date,End date,Amount paid,Payment method';

describe('parseCsv', () => {
  it('reads quotes, commas inside quotes, CRLF and a byte order mark', () => {
    expect(parseCsv('﻿a,b\r\n"Ravi, K","say ""hi"""\r\n')).toEqual([
      ['a', 'b'],
      ['Ravi, K', 'say "hi"'],
    ]);
  });

  it('picks semicolons or tabs when the header uses them', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('parseDate', () => {
  it('reads Indian day-first dates', () => {
    expect(parseDate('25/10/2026')).toBe('2026-10-25');
    expect(parseDate('5-1-26')).toBe('2026-01-05');
    expect(parseDate('25.10.2026')).toBe('2026-10-25');
    expect(parseDate('25-Oct-2026')).toBe('2026-10-25');
    expect(parseDate('25 October 2026')).toBe('2026-10-25');
    expect(parseDate('2026-10-25')).toBe('2026-10-25');
  });

  it('refuses days that don’t exist and other text', () => {
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('10/25/2026')).toBeNull();
    expect(parseDate('next week')).toBeNull();
  });
});

describe('parseMobile', () => {
  it('keeps ten digits from the ways people write a number', () => {
    expect(parseMobile('98400 12345')).toBe('9840012345');
    expect(parseMobile('+91 98400-12345')).toBe('9840012345');
    expect(parseMobile('919840012345')).toBe('9840012345');
    expect(parseMobile('09840012345')).toBe('9840012345');
  });

  it('refuses landlines and short numbers', () => {
    expect(parseMobile('044 2345678')).toBeNull();
    expect(parseMobile('98400')).toBeNull();
  });
});

describe('previewImport', () => {
  it('checks every row and works out the end date from the plan', () => {
    const csv = [
      HEADER,
      'Anu Raj,Anu@Mail.com,98400 11111,monthly,01/10/2026,,1500,UPI',
      'Bala,bala@mail.com,9840022222,,,,,',
      'Chitra,chitra@mail.com,9.84E+09,Weekly,32/10/2026,,abc,cheque',
      'Dev,anu@mail.com,9840044444,Monthly,,,,',
      ',,,,,,,',
    ].join('\n');
    const { rows, missingColumns } = previewImport(csv, plans);
    expect(missingColumns).toEqual([]);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      line: 2,
      email: 'anu@mail.com',
      phone: '9840011111',
      plan: 'Monthly',
      startsOn: '2026-10-01',
      endsOn: '2026-10-30',
      amountPaidCents: 150000,
      paymentMethod: 'upi',
      errors: [],
    });
    expect(rows[1]).toMatchObject({ plan: null, startsOn: null, errors: [] });
    expect(rows[2].errors).toEqual([
      'Mobile: Excel changed it to 9.84E+09. Set the column to Text.',
      'Plan: no plan called "Weekly". Use one of: Monthly, Quarterly.',
      'Start date: write it like 25/10/2026.',
      'Amount paid: write it like 1500.',
      'Payment method: use Cash, UPI, Card or Bank transfer.',
    ]);
    expect(rows[3].errors).toEqual([
      'Email: this email is on an earlier row too.',
      'Start date: add when the membership started.',
    ]);
  });

  it('defaults a paid membership to cash and keeps an end date before the start out', () => {
    const csv = `${HEADER}\nAnu,anu@mail.com,9840011111,Monthly,10/10/2026,01/10/2026,1500,`;
    const [row] = previewImport(csv, plans).rows;
    expect(row.paymentMethod).toBe('cash');
    expect(row.errors).toEqual(['End date: it’s before the start date.']);
  });

  it('asks for a plan when there are dates without one', () => {
    const csv = `${HEADER}\nAnu,anu@mail.com,9840011111,,10/10/2026,,,`;
    expect(previewImport(csv, plans).rows[0].errors).toEqual([
      'Plan: add the plan these dates and amount are for.',
    ]);
  });

  it('reads other apps’ column names in any order', () => {
    const csv =
      'Mobile No,Member Name,Email ID,Package,Joining Date,Expiry Date\n9840011111,Anu,anu@mail.com,Quarterly,1/7/2026,30/9/2026';
    expect(previewImport(csv, plans).rows[0]).toMatchObject({
      name: 'Anu',
      plan: 'Quarterly',
      startsOn: '2026-07-01',
      endsOn: '2026-09-30',
      errors: [],
    });
  });

  it('says which columns are missing', () => {
    expect(previewImport('Name,Phone\nAnu,9840011111', plans).missingColumns).toEqual(['Email']);
  });

  it('skips the template’s example row', () => {
    const preview = previewImport(importTemplate(plans), plans);
    expect(preview.rows).toEqual([]);
    expect(preview.examplesSkipped).toBe(1);
  });
});

describe('isSpreadsheetFile', () => {
  it('spots Excel files the phone can’t read', () => {
    expect(isSpreadsheetFile('members.XLSX')).toBe(true);
    expect(isSpreadsheetFile('members.csv')).toBe(false);
  });
});

describe('joinMessage', () => {
  it('names the gym and tells members to sign up with the email they gave', () => {
    const text = joinMessage('Iron Den Velachery');
    expect(text).toContain('Iron Den Velachery is now on the CoreFit Gym app');
    expect(text).toContain('id=com.corefit.gym');
    expect(text).toContain('use the email you gave the gym');
  });
});
