import type { AppNotification, TrainerMessageInput } from '@/features/notifications/types';

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
