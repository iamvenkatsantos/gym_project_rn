import {
  inboxSections,
  inInbox,
  messageProblem,
  timeAgo,
  unreadCount,
} from '@/features/notifications/rules';
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

describe('inbox', () => {
  const now = new Date(2026, 10, 6, 15, 0);
  const at = (day: number, hour: number) => new Date(2026, 10, day, hour, 0).toISOString();
  const make = (createdAt: string, readAt: string | null) => ({
    ...note('x', readAt),
    createdAt,
  });

  it('keeps today and unread, drops older read ones', () => {
    expect(inInbox(make(at(6, 9), at(6, 10)), now)).toBe(true);
    expect(inInbox(make(at(3, 9), null), now)).toBe(true);
    expect(inInbox(make(at(5, 9), at(5, 10)), now)).toBe(false);
  });

  it('keeps an older one read today until midnight', () => {
    expect(inInbox(make(at(3, 9), at(6, 14)), now)).toBe(true);
    expect(inInbox(make(at(3, 9), at(6, 14)), new Date(2026, 10, 7, 0, 1))).toBe(false);
  });

  it('splits today from earlier', () => {
    const list = [make(at(6, 0), null), make(at(5, 23), null)];
    const { today, earlier } = inboxSections(list, now);
    expect(today).toHaveLength(1);
    expect(earlier).toHaveLength(1);
  });
});
