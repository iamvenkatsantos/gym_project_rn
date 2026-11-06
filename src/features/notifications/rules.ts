import { canManageGym, type GymRole } from '@/features/auth/types';
import type {
  AppNotification,
  NotificationKind,
  PushData,
  TrainerMessageInput,
} from '@/features/notifications/types';

export const MAX_TITLE = 80;
export const MAX_BODY = 500;

/** Ready-made subjects for nudging a trainer about classes. */
export const messageTemplates = [
  'Please schedule a class',
  'Class follow-up',
  'Low bookings, please promote',
  'Members asked for a new time',
] as const;

export function unreadCount(notifications: AppNotification[]) {
  return notifications.filter((n) => !n.readAt).length;
}

/** Midnight at the start of today on this phone, as an ISO time. */
export function startOfToday(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

/**
 * The inbox keeps today's notifications plus anything still unread. Older ones read today stay
 * until midnight, so they don't vanish while the screen that read them is open.
 */
export function inInbox(n: AppNotification, now = new Date()) {
  const since = Date.parse(startOfToday(now));
  return !n.readAt || Date.parse(n.createdAt) >= since || Date.parse(n.readAt) >= since;
}

/** Splits the inbox into today's notifications and older ones, both newest first. */
export function inboxSections(list: AppNotification[], now = new Date()) {
  const since = Date.parse(startOfToday(now));
  const isToday = (n: AppNotification) => Date.parse(n.createdAt) >= since;
  return {
    today: list.filter(isToday),
    earlier: list.filter((n) => !isToday(n)),
  };
}

export function messageProblem(input: Pick<TrainerMessageInput, 'trainerId' | 'title' | 'body'>) {
  if (!input.trainerId) return 'Pick a trainer.';
  if (!input.title.trim()) return 'Add a subject.';
  if (input.title.trim().length > MAX_TITLE)
    return `Keep the subject under ${MAX_TITLE} characters.`;
  if (input.body.length > MAX_BODY) return `Keep the message under ${MAX_BODY} characters.`;
  return null;
}

/** "Just now", "5 min ago", "3 h ago", or the date for anything older than a day. */
export function timeAgo(iso: string, now = new Date()) {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const kinds: readonly NotificationKind[] = [
  'message',
  'trainer_request',
  'trainer_assigned',
  'reminder',
  'booking',
  'membership',
  'attendance',
  'announcement',
  'birthday',
  'workout',
];

/** The data a tapped push carries, or null if it isn't one of ours. */
export function parsePushData(data: unknown): PushData | null {
  if (!data || typeof data !== 'object') return null;
  const { notificationId, gymId, kind } = data as Record<string, unknown>;
  if (typeof notificationId !== 'string' || typeof gymId !== 'string') return null;
  if (!kinds.includes(kind as NotificationKind)) return null;
  return { notificationId, gymId, kind: kind as NotificationKind };
}

/**
 * The gym whose inbox should open for a tapped push. The inbox shows the active gym, so a push
 * from another of the person's gyms switches to it; one from a gym they've left opens nothing.
 */
export function gymForPush(push: PushData, gyms: GymRole[]): string | null {
  return gyms.some((g) => g.gymId === push.gymId) ? push.gymId : null;
}

/**
 * Where a tapped push opens: announcements their list, a birthday push the Birthdays
 * screen for owners and supervisors (members' wishes stay in the inbox), anything else the inbox.
 */
export function pushRoute(push: PushData, gyms: GymRole[]) {
  if (push.kind === 'announcement') return '/announcements' as const;
  const role = gyms.find((g) => g.gymId === push.gymId)?.role;
  if (push.kind === 'birthday' && role && canManageGym(role)) return '/birthdays' as const;
  return '/notifications' as const;
}
