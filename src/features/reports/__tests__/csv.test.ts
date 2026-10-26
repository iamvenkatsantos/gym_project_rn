import { toCsv } from '@/features/reports/csv';

describe('toCsv', () => {
  it('starts with a byte order mark and ends lines with CRLF', () => {
    expect(toCsv(['A', 'B'], [[1, 'x']])).toBe('﻿A,B\r\n1,x\r\n');
  });

  it('quotes commas, quotes and line breaks', () => {
    const csv = toCsv(['Note'], [['Paid, in full'], ['Said "hi"'], ['two\nlines']]);
    expect(csv.split('\r\n').slice(1, 4)).toEqual([
      '"Paid, in full"',
      '"Said ""hi"""',
      '"two\nlines"',
    ]);
  });

  it('leaves empty cells for missing values', () => {
    expect(toCsv(['A', 'B', 'C'], [[null, undefined, NaN]])).toBe('﻿A,B,C\r\n,,\r\n');
  });

  it('stops text from running as a spreadsheet formula', () => {
    const csv = toCsv(['Name'], [['=HYPERLINK("x")'], ['+91 98400'], ['@me'], ['-1']]);
    expect(csv.split('\r\n').slice(1, 5)).toEqual([
      `"'=HYPERLINK(""x"")"`,
      "'+91 98400",
      "'@me",
      "'-1",
    ]);
  });

  it('keeps negative numbers as numbers', () => {
    expect(toCsv(['N'], [[-5]])).toBe('﻿N\r\n-5\r\n');
  });
});
