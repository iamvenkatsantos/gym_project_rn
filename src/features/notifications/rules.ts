import type { GymRole } from '@/features/auth/types';
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
