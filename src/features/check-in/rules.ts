import type { AttendeeRole } from '@/features/attendance/types';
import type { CheckInLink, CheckInRules, ScanResult } from '@/features/check-in/types';
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

/** "You're checked out automatically after 3 h." */
export function autoOutHint(rules: CheckInRules | undefined, role: AttendeeRole) {
  if (!rules) return '';
  const hours = role === 'member' ? rules.memberAutoOutHours : rules.trainerAutoOutHours;
  return `If you forget, you’re checked out automatically after ${formatMinutes(hours * 60)}.`;
}
