import { toCsv } from '@/features/reports/csv';
import { endDateFor, parseRupees, toIsoDate } from '@/features/memberships/rules';
import type { MembershipPlan, PaymentMethod } from '@/features/memberships/types';
import { normalizeEmail, validateEmail, validateName } from '@/lib/validation';

/** The template's columns, in order. Headers are matched loosely, so other apps' exports work too. */
export const IMPORT_COLUMNS = [
  'Name',
  'Email',
  'Mobile',
  'Plan',
  'Start date',
  'End date',
  'Amount paid',
  'Payment method',
] as const;

type Field = 'name' | 'email' | 'phone' | 'plan' | 'startsOn' | 'endsOn' | 'amount' | 'method';

const HEADER_ALIASES: Record<Field, string[]> = {
  name: ['name', 'full name', 'member name', 'member'],
  email: ['email', 'email id', 'e-mail', 'email address', 'mail'],
  phone: [
    'mobile',
    'mobile number',
    'mobile no',
    'phone',
    'phone number',
    'contact',
    'contact number',
  ],
  plan: ['plan', 'plan name', 'package', 'membership', 'membership plan'],
  startsOn: ['start date', 'start', 'starts on', 'from', 'joining date', 'join date'],
  endsOn: [
    'end date',
    'end',
    'ends on',
    'to',
    'expiry',
    'expiry date',
    'valid till',
    'valid until',
  ],
  amount: ['amount paid', 'amount', 'paid', 'fee', 'fees'],
  method: ['payment method', 'method', 'payment mode', 'mode', 'paid by'],
};

/** The template's example row. Rows with an @example.com email are never imported. */
const EXAMPLE_DOMAIN = '@example.com';

/** At most this many members in one file; bigger gyms import in parts. */
export const MAX_IMPORT_ROWS = 1000;

/** A CSV to fill in, with one example row showing the formats. */
export function importTemplate(plans: Pick<MembershipPlan, 'name'>[]) {
  return toCsv(
    [...IMPORT_COLUMNS],
    [
      [
        'Example Member (delete this row)',
        'member' + EXAMPLE_DOMAIN,
        '9840012345',
        plans[0]?.name ?? 'Monthly',
        '01/10/2026',
        '31/10/2026',
        1500,
        'Cash',
      ],
    ],
  );
}

/**
 * Splits CSV text into rows of cells: quoted cells, "" inside quotes, CRLF or
 * LF line ends and a byte order mark. Excel in some regions saves with
 * semicolons and "Text (Tab delimited)" with tabs, so the header picks the separator.
 */
export function parseCsv(text: string): string[][] {
  const body = text.replace(/^﻿/, '');
  const firstLine = body.slice(0, body.search(/\r?\n|$/));
  const separator = [',', ';', '\t'].reduce((best, s) =>
    firstLine.split(s).length > firstLine.split(best).length ? s : best,
  );
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cell += c;
      }
    } else if (c === '"' && cell === '') {
      quoted = true;
    } else if (c === separator) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && body[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * A date as owners type it in India, to YYYY-MM-DD: 25/10/2026, 25-10-2026,
 * 25.10.26, 25-Oct-2026, 25 Oct 2026 or 2026-10-25. Day comes before month.
 * Null for anything else, or a day that doesn't exist.
 */
export function parseDate(text: string): string | null {
  const value = text.trim().toLowerCase();
  let y: number;
  let m: number;
  let d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(value))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})[\s-]([a-z]{3})[a-z]*[\s-,]+(\d{2}|\d{4})$/.exec(value))) {
    [d, m, y] = [Number(match[1]), MONTHS.indexOf(match[2]) + 1, Number(match[3])];
  } else {
    return null;
  }
  if (y < 100) y += 2000;
  const date = new Date(y, m - 1, d);
  if (m < 1 || date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return toIsoDate(date);
}

/**
 * An Indian mobile number as ten digits, from "98400 12345", "+91 98400-12345"
 * or "919840012345" (Excel drops the +). Null if it isn't one.
 */
export function parseMobile(text: string): string | null {
  const digits = text.replace(/[\s()+-]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  const ten = local.length === 11 && local.startsWith('0') ? local.slice(1) : local;
  return /^[6-9]\d{9}$/.test(ten) ? ten : null;
}

const METHODS: Record<string, PaymentMethod> = {
  cash: 'cash',
  upi: 'upi',
  gpay: 'upi',
  phonepe: 'upi',
  paytm: 'upi',
  card: 'card',
  'bank transfer': 'bank_transfer',
  bank: 'bank_transfer',
  neft: 'bank_transfer',
  imps: 'bank_transfer',
  complimentary: 'complimentary',
  free: 'complimentary',
};

/** One member from the file, ready to send or with what to fix. */
export type ImportRow = {
  /** The line in the file, counting the header as line 1, so the owner can find it. */
  line: number;
  name: string;
  email: string;
  phone: string | null;
  plan: string | null;
  startsOn: string | null;
  endsOn: string | null;
  amountPaidCents: number | null;
  paymentMethod: PaymentMethod | null;
  errors: string[];
};

export type ImportPreview = {
  rows: ImportRow[];
  /** Columns the file is missing, which stops the import. */
  missingColumns: string[];
  /** Example rows from the template that were left in and skipped. */
  examplesSkipped: number;
  /** More than MAX_IMPORT_ROWS members; only the first ones are kept. */
  truncated: boolean;
};

/** Reads the owner's file and checks every row against the gym's plans before anything is sent. */
export function previewImport(text: string, plans: MembershipPlan[]): ImportPreview {
  const [header = [], ...lines] = parseCsv(text);
  const normalized = header.map((h) => h.trim().toLowerCase().replace(/[*:]/g, '').trim());
  const column = Object.fromEntries(
    (Object.keys(HEADER_ALIASES) as Field[]).map((field) => [
      field,
      normalized.findIndex((h) => HEADER_ALIASES[field].includes(h)),
    ]),
  ) as Record<Field, number>;
  const missingColumns = (['name', 'email', 'phone'] as const)
    .filter((f) => column[f] < 0)
    .map((f) => ({ name: 'Name', email: 'Email', phone: 'Mobile' })[f]);
  if (missingColumns.length) {
    return { rows: [], missingColumns, examplesSkipped: 0, truncated: false };
  }

  const byName = new Map(plans.map((p) => [p.name.trim().toLowerCase(), p]));
  const seen = new Set<string>();
  const rows: ImportRow[] = [];
  let examplesSkipped = 0;

  lines.forEach((cells, index) => {
    const get = (f: Field) => (column[f] >= 0 ? (cells[column[f]] ?? '').trim() : '');
    if (cells.every((c) => !c.trim())) return;
    const email = normalizeEmail(get('email'));
    if (email.endsWith(EXAMPLE_DOMAIN)) {
      examplesSkipped++;
      return;
    }
    const errors: string[] = [];

    const name = get('name').replace(/\s+/g, ' ');
    const nameError = validateName(name);
    if (nameError) errors.push(`Name: ${nameError}`);

    const emailError = validateEmail(email);
    if (emailError) errors.push(`Email: ${emailError}`);
    else if (seen.has(email)) errors.push('Email: this email is on an earlier row too.');
    seen.add(email);

    const rawPhone = get('phone');
    const phone = parseMobile(rawPhone);
    if (!rawPhone) errors.push('Mobile: add their mobile number.');
    else if (/e\+?\d+$/i.test(rawPhone)) {
      errors.push(
        'Mobile: Excel turned it into a number like 9.84E+09. Format the column as Text.',
      );
    } else if (!phone) errors.push('Mobile: enter a 10-digit Indian mobile number.');

    const planText = get('plan');
    const plan = planText ? byName.get(planText.toLowerCase()) : undefined;
    const rawStart = get('startsOn');
    const rawEnd = get('endsOn');
    const rawAmount = get('amount');
    const rawMethod = get('method').toLowerCase();
    let startsOn: string | null = null;
    let endsOn: string | null = null;
    let amountPaidCents: number | null = null;
    let paymentMethod: PaymentMethod | null = null;

    if (planText && !plan) {
      errors.push(
        `Plan: no plan called "${planText}". Use one of: ${plans.map((p) => p.name).join(', ') || 'add plans under Memberships first'}.`,
      );
    }
    if (!planText && (rawStart || rawEnd || rawAmount)) {
      errors.push('Plan: add the plan these dates and amount are for.');
    }
    if (planText) {
      startsOn = rawStart ? parseDate(rawStart) : null;
      if (!rawStart) errors.push('Start date: add when the membership started.');
      else if (!startsOn) errors.push('Start date: write it like 25/10/2026.');
      if (rawEnd) {
        endsOn = parseDate(rawEnd);
        if (!endsOn) errors.push('End date: write it like 25/11/2026.');
        else if (startsOn && endsOn < startsOn)
          errors.push('End date: it’s before the start date.');
      } else if (startsOn && plan) {
        endsOn = endDateFor(startsOn, plan.durationDays);
      }
      if (rawAmount) {
        amountPaidCents = parseRupees(rawAmount);
        if (amountPaidCents === null) errors.push('Amount paid: write it like 1500.');
      }
      if (rawMethod) {
        paymentMethod = METHODS[rawMethod] ?? null;
        if (!paymentMethod) errors.push('Payment method: use Cash, UPI, Card or Bank transfer.');
      } else if (amountPaidCents !== null) {
        paymentMethod = 'cash';
      }
    }

    rows.push({
      line: index + 2,
      name,
      email,
      phone,
      plan: plan?.name ?? (planText || null),
      startsOn,
      endsOn,
      amountPaidCents,
      paymentMethod,
      errors,
    });
  });

  const truncated = rows.length > MAX_IMPORT_ROWS;
  return { rows: rows.slice(0, MAX_IMPORT_ROWS), missingColumns: [], examplesSkipped, truncated };
}

/** True for a file the phone can't read as text, like an .xlsx straight from Excel. */
export function isSpreadsheetFile(fileName: string) {
  return /\.(xlsx|xls|xlsm|ods|numbers)$/i.test(fileName);
}
