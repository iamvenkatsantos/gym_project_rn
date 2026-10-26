export type CsvCell = string | number | null | undefined;

/**
 * Spreadsheet apps run a cell that starts with one of these as a formula, so
 * a member named "=HYPERLINK(...)" could do something when the owner opens
 * the file. Text cells that start with one get a leading apostrophe.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: CsvCell) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * A CSV file as Excel and Google Sheets expect it: a header row, CRLF line
 * ends, and a byte order mark so names in Tamil or Hindi and ₹ open correctly.
 */
export function toCsv(header: string[], rows: CsvCell[][]) {
  return '﻿' + [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
