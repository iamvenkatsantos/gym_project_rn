import type { HourCount, MemberInsight, MonthRevenue } from '@/features/insights/types';
import { membershipStatus } from '@/features/memberships/rules';
import { formatPrice } from '@/lib/format';

const DAY = 24 * 60 * 60 * 1000;

/** Members who haven't come in for this many days are worth a call. */
export const AWAY_DAYS = 14;
/** How far back "recently lapsed" looks. */
export const LAPSED_WINDOW_DAYS = 60;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function parseDate(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from an ISO date to today; 0 on the day itself. */
export function daysSince(isoDate: string, today: Date = new Date()) {
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((start - parseDate(isoDate)) / DAY);
}

/** "Oct" for "2026-10-01". */
export function monthLabel(month: string) {
  return MONTHS[Number(month.slice(5, 7)) - 1];
}

/** Whole rupees, "₹1,499", so big numbers fit a tile. */
export function wholeMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * Short money for chart labels: ₹950, ₹4.5k, ₹45k, ₹1.2L, ₹3.4Cr. Indian
 * lakhs and crores for rupees; other currencies use the phone's format.
 */
export function compactMoney(cents: number, currency: string) {
  if (currency !== 'INR') return formatPrice(cents, currency);
  const rupees = cents / 100;
  const short = (n: number) => (n < 10 ? n.toFixed(1).replace(/\.0$/, '') : String(Math.round(n)));
  if (rupees < 1000) return `₹${Math.round(rupees)}`;
  if (rupees < 100000) return `₹${short(rupees / 1000)}k`;
  if (rupees < 10000000) return `₹${short(rupees / 100000)}L`;
  return `₹${short(rupees / 10000000)}Cr`;
}

export type RevenueSummary = {
  thisMonth: MonthRevenue | undefined;
  lastMonth: MonthRevenue | undefined;
  /** Percent change from last month, or null when last month had nothing to compare. */
  change: number | null;
  /** Average of the full months before this one, or null if there are none with money. */
  monthlyAverageCents: number | null;
};

/** `months` is oldest first and ends with this month, as the server sends it. */
export function revenueSummary(months: MonthRevenue[]): RevenueSummary {
  const thisMonth = months.at(-1);
  const lastMonth = months.at(-2);
  const change =
    thisMonth && lastMonth && lastMonth.amountCents > 0
      ? Math.round(((thisMonth.amountCents - lastMonth.amountCents) / lastMonth.amountCents) * 100)
      : null;
  const past = months.slice(0, -1);
  const pastTotal = past.reduce((sum, m) => sum + m.amountCents, 0);
  return {
    thisMonth,
    lastMonth,
    change,
    monthlyAverageCents: pastTotal > 0 ? Math.round(pastTotal / past.length) : null,
  };
}

/** "+12%", "-8%" or "0%". */
export function formatChange(change: number) {
  return `${change > 0 ? '+' : ''}${change}%`;
}

export type MemberHealth = {
  total: number;
  /** Paid up today, including those starting later and those about to end. */
  active: number;
  expiringSoon: number;
  lapsed: number;
  noPlan: number;
  /** Active members who haven't come in for AWAY_DAYS days, longest away first. */
  away: MemberInsight[];
  /** Lapsed in the last LAPSED_WINDOW_DAYS days, most recent first. */
  recentlyLapsed: MemberInsight[];
  /** Average visits a week over the last 30 days per active member. */
  visitsPerWeek: number | null;
};

export function memberHealth(members: MemberInsight[], today: Date = new Date()): MemberHealth {
  const health: MemberHealth = {
    total: members.length,
    active: 0,
    expiringSoon: 0,
    lapsed: 0,
    noPlan: 0,
    away: [],
    recentlyLapsed: [],
    visitsPerWeek: null,
  };
  let activeVisits = 0;
  for (const m of members) {
    if (!m.startsOn || !m.endsOn) {
      health.noPlan += 1;
      continue;
    }
    const status = membershipStatus({ startsOn: m.startsOn, endsOn: m.endsOn }, today);
    if (status === 'expired') {
      health.lapsed += 1;
      if (daysSince(m.endsOn, today) <= LAPSED_WINDOW_DAYS) health.recentlyLapsed.push(m);
      continue;
    }
    health.active += 1;
    activeVisits += m.visitsLast30Days;
    if (status === 'expiringSoon') health.expiringSoon += 1;
    // Someone who just joined hasn't had the chance to stay away yet.
    const since = m.lastVisit ?? (status === 'upcoming' ? null : m.startsOn);
    if (since && daysSince(since, today) >= AWAY_DAYS) health.away.push(m);
  }
  health.away.sort((a, b) => (a.lastVisit ?? '').localeCompare(b.lastVisit ?? ''));
  health.recentlyLapsed.sort((a, b) => (b.endsOn ?? '').localeCompare(a.endsOn ?? ''));
  if (health.active > 0) {
    health.visitsPerWeek = Math.round((activeVisits / health.active / (30 / 7)) * 10) / 10;
  }
  return health;
}

/** "6am", "12pm", "9pm". */
export function hourLabel(hour: number) {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${hour < 12 ? 'am' : 'pm'}`;
}

/** "6–7 PM". */
export function hourRangeLabel(hour: number) {
  const part = (h: number) => (h % 12 === 0 ? 12 : h % 12);
  const suffix = (h: number) => (h % 24 < 12 ? 'AM' : 'PM');
  const end = (hour + 1) % 24;
  return suffix(hour) === suffix(end)
    ? `${part(hour)}–${part(end)} ${suffix(end)}`
    : `${part(hour)} ${suffix(hour)}–${part(end)} ${suffix(end)}`;
}

export function weekdayName(weekday: number) {
  return WEEKDAYS[weekday - 1];
}

export type HourlyLoad = {
  total: number;
  /** Check-ins per hour from `firstHour` to `lastHour`, both included. */
  byHour: { hour: number; checkIns: number }[];
  /** Check-ins per weekday, Monday first. */
  byWeekday: { weekday: number; checkIns: number }[];
  busiestHour: number | null;
  busiestWeekday: number | null;
};

/** Gyms are usually open 5am to 11pm; hours outside that only show when someone came then. */
const OPEN_HOURS = { first: 5, last: 22 };

export function hourlyLoad(counts: HourCount[]): HourlyLoad {
  const hours = new Array<number>(24).fill(0);
  const days = new Array<number>(7).fill(0);
  for (const c of counts) {
    hours[c.hour] += c.checkIns;
    days[c.weekday - 1] += c.checkIns;
  }
  const used = hours.flatMap((n, h) => (n > 0 ? [h] : []));
  const first = Math.min(OPEN_HOURS.first, ...used);
  const last = Math.max(OPEN_HOURS.last, ...used);
  const argmax = (values: number[]) => {
    const max = Math.max(...values);
    return max > 0 ? values.indexOf(max) : null;
  };
  const busiestDay = argmax(days);
  return {
    total: hours.reduce((sum, n) => sum + n, 0),
    byHour: hours.slice(first, last + 1).map((checkIns, i) => ({ hour: first + i, checkIns })),
    byWeekday: days.map((checkIns, i) => ({ weekday: i + 1, checkIns })),
    busiestHour: argmax(hours),
    busiestWeekday: busiestDay === null ? null : busiestDay + 1,
  };
}
