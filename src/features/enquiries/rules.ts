import type { PillTone } from '@/components/pill';
import type {
  Enquiry,
  EnquiryFilter,
  EnquirySource,
  EnquiryStatus,
  FollowUpKind,
} from '@/features/enquiries/types';
import { formatRelativeDay, formatTime } from '@/lib/format';

const DAY = 24 * 60 * 60 * 1000;

export const statusLabels: Record<EnquiryStatus, string> = {
  new: 'New',
  following_up: 'Following up',
  trial: 'On trial',
  joined: 'Joined',
  lost: 'Lost',
};

export const statusTones: Record<EnquiryStatus, PillTone> = {
  new: 'accent',
  following_up: 'warning',
  trial: 'success',
  joined: 'accent',
  lost: 'neutral',
};

export const sourceOptions: { value: EnquirySource; label: string }[] = [
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone', label: 'Phone call' },
  { value: 'referral', label: 'Referral' },
  { value: 'social', label: 'Social media' },
  { value: 'other', label: 'Other' },
];

export const sourceLabels = Object.fromEntries(
  sourceOptions.map((o) => [o.value, o.label]),
) as Record<EnquirySource, string>;

export const followUpKinds: { value: FollowUpKind; label: string }[] = [
  { value: 'call', label: 'Call' },
  { value: 'visit', label: 'Visit' },
  { value: 'note', label: 'Note' },
];

/** The usual reasons people don't join, so the owner can see patterns. */
export const lostReasons = [
  'Too expensive',
  'Joined another gym',
  'Timings don’t suit',
  'Too far away',
  'Not interested now',
  'No response',
];

export const trialLengths = [1, 3, 7];

export function isOpen(enquiry: Pick<Enquiry, 'status'>) {
  return (
    enquiry.status === 'new' || enquiry.status === 'following_up' || enquiry.status === 'trial'
  );
}

function endOfDay(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
}

/** Open, with a follow-up due before today ends (or already late). */
export function isDue(enquiry: Enquiry, now: Date = new Date()) {
  return (
    isOpen(enquiry) &&
    enquiry.nextFollowUpAt !== null &&
    Date.parse(enquiry.nextFollowUpAt) < endOfDay(now)
  );
}

export function isOverdue(enquiry: Enquiry, now: Date = new Date()) {
  return (
    isOpen(enquiry) &&
    enquiry.nextFollowUpAt !== null &&
    Date.parse(enquiry.nextFollowUpAt) < now.getTime()
  );
}

/** Open ones first by follow-up time (none last), then the rest newest first. */
export function sortEnquiries(list: Enquiry[]) {
  const followUp = (e: Enquiry) =>
    e.nextFollowUpAt ? Date.parse(e.nextFollowUpAt) : Number.POSITIVE_INFINITY;
  return [...list].sort((a, b) => {
    const open = Number(isOpen(b)) - Number(isOpen(a));
    if (open) return open;
    if (isOpen(a)) {
      const due = followUp(a) - followUp(b);
      if (due) return due;
    }
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

function matches(enquiry: Enquiry, filter: EnquiryFilter, now: Date) {
  switch (filter) {
    case 'open':
      return isOpen(enquiry);
    case 'due':
      return isDue(enquiry, now);
    case 'trial':
      return enquiry.status === 'trial';
    case 'joined':
    case 'lost':
      return enquiry.status === filter;
    case 'all':
      return true;
  }
}

export function filterEnquiries(
  list: Enquiry[],
  filter: EnquiryFilter,
  query: string,
  now: Date = new Date(),
) {
  const text = query.trim().toLowerCase();
  const digits = text.replace(/\D/g, '');
  return sortEnquiries(
    list.filter(
      (e) =>
        matches(e, filter, now) &&
        (!text ||
          e.fullName.toLowerCase().includes(text) ||
          e.interest.toLowerCase().includes(text) ||
          (digits.length >= 3 && e.phone.includes(digits))),
    ),
  );
}

export function countEnquiries(
  list: Enquiry[],
  now: Date = new Date(),
): Record<EnquiryFilter, number> {
  const filters: EnquiryFilter[] = ['open', 'due', 'trial', 'joined', 'lost', 'all'];
  return Object.fromEntries(
    filters.map((f) => [f, list.filter((e) => matches(e, f, now)).length]),
  ) as Record<EnquiryFilter, number>;
}

/** Enquiries over the last `days` days and how many of them joined. */
export function conversion(list: Enquiry[], days = 30, now: Date = new Date()) {
  const since = now.getTime() - days * DAY;
  const recent = list.filter((e) => Date.parse(e.createdAt) >= since);
  const joined = recent.filter((e) => e.status === 'joined').length;
  return {
    enquiries: recent.length,
    joined,
    rate: recent.length ? Math.round((joined / recent.length) * 100) : null,
  };
}

/** Indian mobiles are kept as their 10 digits; anything else keeps its + and digits. */
export function normalizePhone(text: string) {
  const cleaned = text.replace(/[\s()-]/g, '');
  const indian = cleaned.match(/^(?:\+91|91|0)?([6-9]\d{9})$/);
  return indian ? indian[1] : cleaned;
}

export function callUrl(phone: string) {
  return `tel:${phone.length === 10 ? `+91${phone}` : phone}`;
}

export function whatsappUrl(phone: string, text?: string) {
  const number = phone.length === 10 ? `91${phone}` : phone.replace(/^\+/, '');
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** "9840012345" → "98400 12345", easier to read out on a call. */
export function formatPhone(phone: string) {
  return phone.length === 10 ? `${phone.slice(0, 5)} ${phone.slice(5)}` : phone;
}

/** Another enquiry with the same number, so the desk doesn't add someone twice. */
export function findDuplicate(list: Enquiry[], phone: string, exceptId?: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) return undefined;
  return list.find((e) => e.id !== exceptId && e.phone === normalized);
}

/** YYYY-MM-DD for a local date. */
export function localDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseLocalDate(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function trialDates(startsOn: Date, days: number) {
  const start = new Date(startsOn.getFullYear(), startsOn.getMonth(), startsOn.getDate());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + days - 1);
  return { trialStartsOn: localDate(start), trialEndsOn: localDate(end) };
}

/** Where a trial pass stands today: "Day 2 of 3", or that it hasn't started or has ended. */
export function trialProgress(
  enquiry: Pick<Enquiry, 'trialStartsOn' | 'trialEndsOn'>,
  now: Date = new Date(),
) {
  if (!enquiry.trialStartsOn || !enquiry.trialEndsOn) return null;
  const start = parseLocalDate(enquiry.trialStartsOn).getTime();
  const end = parseLocalDate(enquiry.trialEndsOn).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const length = Math.round((end - start) / DAY) + 1;
  if (today < start) {
    return {
      state: 'upcoming' as const,
      length,
      label: `Starts ${formatRelativeDay(new Date(start).toISOString(), now)}`,
    };
  }
  if (today > end) return { state: 'ended' as const, length, label: 'Trial ended' };
  const day = Math.round((today - start) / DAY) + 1;
  return {
    state: 'active' as const,
    length,
    label: day === length ? `Last day of ${length}` : `Day ${day} of ${length}`,
  };
}

/** A trial's follow-up: 5 PM on its last day, or in an hour if that's already gone. */
export function trialFollowUp(trialEndsOn: string, now: Date = new Date()) {
  const end = parseLocalDate(trialEndsOn);
  const at = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 17);
  return at.getTime() > now.getTime() ? at : new Date(now.getTime() + 60 * 60 * 1000);
}

/** New enquiries get a call back tomorrow at 10 AM unless the desk picks otherwise. */
export function defaultFollowUp(now: Date = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10);
}

/** "Follow up today, 6:00 PM" or "Overdue since today, 10:00 AM". */
export function followUpLabel(iso: string, now: Date = new Date()) {
  const day = formatRelativeDay(iso, now).replace(/^(Today|Tomorrow)$/, (d) => d.toLowerCase());
  const when = `${day}, ${formatTime(iso)}`;
  return Date.parse(iso) < now.getTime() ? `Overdue since ${when}` : `Follow up ${when}`;
}

/** One line under an enquiry's name in a list. */
export function enquirySummary(enquiry: Enquiry, now: Date = new Date()) {
  if (enquiry.status === 'joined') return 'Joined the gym';
  if (enquiry.status === 'lost') return enquiry.lostReason ? `Lost: ${enquiry.lostReason}` : 'Lost';
  const parts: string[] = [];
  if (enquiry.status === 'trial') {
    const trial = trialProgress(enquiry, now);
    if (trial) parts.push(`Trial: ${trial.label.toLowerCase()}`);
  }
  parts.push(
    enquiry.nextFollowUpAt ? followUpLabel(enquiry.nextFollowUpAt, now) : 'No follow-up set',
  );
  return parts.join(' · ');
}

/** Why a follow-up time can't be used, or null. */
export function followUpProblem(value: Date | null, now: Date = new Date()) {
  return value && value.getTime() < now.getTime() ? 'Pick a follow-up time later than now.' : null;
}
