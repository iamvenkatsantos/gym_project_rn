import {
  announcementProblem,
  latestRecent,
  reaches,
  visibleTo,
} from '@/features/announcements/rules';
import type { Announcement, Audience } from '@/features/announcements/types';

const post = (
  id: string,
  audience: Audience,
  createdAt = '2026-10-26T10:00:00Z',
): Announcement => ({
  id,
  senderName: 'Olivia',
  audience,
  title: 'Hi',
  body: '',
  createdAt,
});

describe('announcements', () => {
  it('reaches the right roles', () => {
    expect(reaches('everyone', 'member')).toBe(true);
    expect(reaches('members', 'member')).toBe(true);
    expect(reaches('members', 'trainer')).toBe(false);
    expect(reaches('staff', 'member')).toBe(false);
    expect(reaches('staff', 'trainer')).toBe(true);
    expect(reaches('staff', 'owner')).toBe(true);
  });

  it('shows managers everything and others only what is for them', () => {
    const list = [post('a', 'everyone'), post('b', 'members'), post('c', 'staff')];
    expect(visibleTo(list, 'member').map((a) => a.id)).toEqual(['a', 'b']);
    expect(visibleTo(list, 'trainer').map((a) => a.id)).toEqual(['a', 'c']);
    expect(visibleTo(list, 'supervisor').map((a) => a.id)).toEqual(['a', 'b', 'c']);
  });

  it('needs a title and keeps the message short', () => {
    expect(announcementProblem({ audience: 'everyone', title: ' ', body: '' })).toMatch(/title/);
    expect(
      announcementProblem({ audience: 'everyone', title: 'Hi', body: 'x'.repeat(501) }),
    ).toMatch(/under 500/);
    expect(announcementProblem({ audience: 'members', title: 'Holiday', body: '' })).toBeNull();
  });

  it('picks the newest announcement from this week', () => {
    const now = new Date('2026-10-26T12:00:00Z');
    const list = [
      post('new', 'everyone', '2026-10-25T09:00:00Z'),
      post('old', 'everyone', '2026-10-10T09:00:00Z'),
    ];
    expect(latestRecent(list, 7, now)?.id).toBe('new');
    expect(latestRecent([list[1]], 7, now)).toBeNull();
  });
});
