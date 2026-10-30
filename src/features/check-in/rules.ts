import type { AttendeeRole } from '@/features/attendance/types';
import type { CheckInLink, CheckInRules, GymHours, ScanResult } from '@/features/check-in/types';
import { clockTime, formatMinutes, minutesAtGym } from '@/features/attendance/rules';

/** The app's own link scheme, from app.json. Phone cameras open it in the app. */
const SCHEME = 'corefit';

/** The link a branch QR encodes. */
export function checkInLink({ gymId, code }: CheckInLink) {
  return `${SCHEME}://check-in?gym=${encodeURIComponent(gymId)}&code=${encodeURIComponent(code)}`;
}

/** The gym and code from a scanned QR, or null if it isn't a CoreFit Gym check-in QR. */
export function parseCheckInLink(data: string): CheckInLink | null {
  const match = /^corefit:\/\/\/?check-in\?(.*)$/i.exec(data.trim());
  if (!match) return null;
  const params = new Map<string, string>();
  for (const pair of match[1].split('&')) {
    const [key, value = ''] = pair.split('=');
    try {
      params.set(key, decodeURIComponent(value));
    } catch {
      return null;
    }
  }
  const gymId = params.get('gym');
  const code = params.get('code');
  return gymId && code ? { gymId, code } : null;
}

/** The headline after a scan. */
export function scanHeadline(result: ScanResult) {
  switch (result.action) {
    case 'in':
      return 'Checked in';
    case 'out':
      return 'Checked out';
    case 'already_in':
      return 'You’re already checked in';
  }
}

/** The line under it: where, when, and for how long. */
export function scanDetail(result: ScanResult, now = new Date()) {
  if (result.action === 'out' && result.checkedOutAt) {
    return `${result.gymName} · ${formatMinutes(minutesAtGym(result))} today. See you next time!`;
  }
  if (result.action === 'already_in') {
    return `${result.gymName} · in since ${clockTime(result.checkedInAt)}. Scan again when you leave.`;
  }
  return `${result.gymName} · ${clockTime(now.toISOString())}. Scan again when you leave.`;
}

/** "05:30" as 330 minutes after midnight, or null. */
export function minutesOfDay(time: string | null) {
  const match = time ? /^(\d{1,2}):(\d{2})/.exec(time) : null;
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** 330 as "5:30 am", 1320 as "10:00 pm". The same on every phone, whatever its locale. */
export function timeOfDay(minutes: number) {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/** The branch's hours from its rules; null when it's open all day. */
export function gymHours(rules: Pick<CheckInRules, 'opensAt' | 'closesAt'> | undefined): GymHours {
  const opensAt = minutesOfDay(rules?.opensAt ?? null);
  const closesAt = minutesOfDay(rules?.closesAt ?? null);
  return opensAt === null || closesAt === null ? null : { opensAt, closesAt };
}

/** "Open 5:30 am – 10:00 pm", or "Open 24 hours". */
export function hoursLine(hours: GymHours) {
  return hours
    ? `Open ${timeOfDay(hours.opensAt)} – ${timeOfDay(hours.closesAt)}`
    : 'Open 24 hours';
}

/** "You're checked out automatically at 10:00 pm or after 3 h." */
export function autoOutHint(rules: CheckInRules | undefined, role: AttendeeRole) {
  if (!rules) return '';
  const hours = role === 'member' ? rules.memberAutoOutHours : rules.trainerAutoOutHours;
  const after = formatMinutes(hours * 60);
  const closing = gymHours(rules)?.closesAt;
  return closing === undefined
    ? `If you forget, you’re checked out automatically after ${after}.`
    : `If you forget, you’re checked out at closing (${timeOfDay(closing)}) or after ${after}.`;
}

/** "Pulse Fitness Velachery check-in QR.png", safe as a file name. */
export function qrFileName(gymName: string) {
  const name = gymName.replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'Branch';
  return `${name} check-in QR.png`;
}
