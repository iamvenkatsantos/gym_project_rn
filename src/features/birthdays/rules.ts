import type { GymPerson } from '@/features/members/types';
import { toIsoDate } from '@/features/memberships/rules';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The youngest a member can be, matching the server's check. */
export const MIN_AGE = 5;

/** How far ahead the Birthdays screen looks. */
export const UPCOMING_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Formats what's typed into a date of birth field as DD/MM/YYYY, adding the
 * slashes as the digits go in, so a number pad is all it takes.
 */
export function formatBirthDateInput(text: string) {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** "15/06/1995" (or 15-06-1995, 15.6.1995) → "1995-06-15". Day first; null if it isn't a date. */
export function parseBirthDate(text: string): string | null {
  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text.trim());
  if (!match) return null;
  const [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return toIsoDate(date);
}

/** "1995-06-15" → "15/06/1995", for a form's starting value. */
export function birthDateInput(isoDate: string | null | undefined) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

/** What's wrong with a typed date of birth, or null. Empty is fine unless it's required. */
export function validateBirthDate(
  text: string,
  { required = false }: { required?: boolean } = {},
  today: Date = new Date(),
): string | null {
  if (!text.trim()) return required ? 'Enter your date of birth.' : null;
  const iso = parseBirthDate(text);
  if (!iso) return 'Enter the date as DD/MM/YYYY.';
  const latest = new Date(today.getFullYear() - MIN_AGE, today.getMonth(), today.getDate());
  if (iso < '1900-01-01' || iso > toIsoDate(latest)) return 'Enter a valid date of birth.';
  return null;
}

/** This year's (or the given year's) birthday; 29 Feb falls on 28 Feb outside leap years. */
function birthdayIn(isoDob: string, year: number) {
  const [, m, d] = isoDob.split('-').map(Number);
  const lastDay = new Date(year, m, 0).getDate();
  return new Date(year, m - 1, Math.min(d, lastDay));
}

/** Days from today to the next birthday: 0 on the day itself. */
export function daysUntilBirthday(isoDob: string, today: Date = new Date()) {
  const day = startOfDay(today);
  let next = birthdayIn(isoDob, day.getFullYear());
  if (next < day) next = birthdayIn(isoDob, day.getFullYear() + 1);
  return Math.round((next.getTime() - day.getTime()) / DAY_MS);
}

export function isBirthdayToday(isoDob: string | null | undefined, today: Date = new Date()) {
  return !!isoDob && daysUntilBirthday(isoDob, today) === 0;
}

/** How old they turn on their next birthday (today, if it's today). */
export function turningAge(isoDob: string, today: Date = new Date()) {
  const birthYear = Number(isoDob.slice(0, 4));
  const day = startOfDay(today);
  const thisYear = birthdayIn(isoDob, day.getFullYear());
  return day.getFullYear() - birthYear + (thisYear < day ? 1 : 0);
}

/** Age today. */
export function ageOn(isoDob: string, today: Date = new Date()) {
  const turning = turningAge(isoDob, today);
  return isBirthdayToday(isoDob, today) ? turning : turning - 1;
}

/** "1995-06-15" → "15 Jun", the same on every phone. */
export function birthdayLabel(isoDob: string) {
  const [, m, d] = isoDob.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "Today", "Tomorrow", "In 5 days". */
export function whenLabel(days: number) {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

export type UpcomingBirthday = { person: GymPerson; days: number; turning: number };

/** Active members with a birthday in the next `within` days, soonest first. */
export function upcomingBirthdays(
  people: GymPerson[],
  today: Date = new Date(),
  within: number = UPCOMING_DAYS,
): UpcomingBirthday[] {
  return people
    .filter((p) => p.role === 'member' && p.status === 'active' && p.dateOfBirth)
    .map((person) => ({
      person,
      days: daysUntilBirthday(person.dateOfBirth!, today),
      turning: turningAge(person.dateOfBirth!, today),
    }))
    .filter((b) => b.days <= within)
    .sort((a, b) => a.days - b.days || a.person.fullName.localeCompare(b.person.fullName));
}

/** Active members without a date of birth on file. */
export function missingBirthdays(people: GymPerson[]) {
  return people.filter((p) => p.role === 'member' && p.status === 'active' && !p.dateOfBirth)
    .length;
}

/** The WhatsApp wish staff send themselves. */
export function birthdayMessage(fullName: string, gymName: string) {
  const firstName = fullName.trim().split(/\s+/)[0] || 'there';
  return `Happy birthday, ${firstName}! 🎂 Wishing you a healthy and strong year ahead. From all of us at ${gymName}.`;
}
