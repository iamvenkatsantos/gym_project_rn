import { messageProblem, timeAgo, unreadCount } from '@/features/notifications/rules';
import type { AppNotification } from '@/features/notifications/types';

const note = (id: string, readAt: string | null): AppNotification => ({
  id,
  recipientId: 'tom',
  senderName: null,
  kind: 'message',
  title: 'Hi',
  body: '',
  classId: null,
  createdAt: '2026-10-24T10:00:00Z',
  readAt,
});

describe('notifications', () => {
  it('counts unread', () => {
    expect(unreadCount([note('a', null), note('b', '2026-10-24T11:00:00Z'), note('c', null)])).toBe(
      2,
    );
  });

  it('needs a trainer and a subject', () => {
    expect(messageProblem({ trainerId: '', title: 'Hi', body: '' })).toMatch(/trainer/);
    expect(messageProblem({ trainerId: 'tom', title: '  ', body: '' })).toMatch(/subject/);
    expect(messageProblem({ trainerId: 'tom', title: 'Hi', body: 'x'.repeat(501) })).toMatch(
      /under 500/,
    );
    expect(messageProblem({ trainerId: 'tom', title: 'Please schedule', body: '' })).toBeNull();
  });

  it('says how long ago', () => {
    const now = new Date('2026-10-24T12:00:00Z');
    expect(timeAgo('2026-10-24T11:59:40Z', now)).toBe('Just now');
    expect(timeAgo('2026-10-24T11:45:00Z', now)).toBe('15 min ago');
    expect(timeAgo('2026-10-24T09:00:00Z', now)).toBe('3 h ago');
  });
});
