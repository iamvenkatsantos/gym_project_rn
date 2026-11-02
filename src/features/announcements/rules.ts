import { canManageGym, type Role } from '@/features/auth/types';
import type { Announcement, AnnouncementInput, Audience } from '@/features/announcements/types';

export const MAX_TITLE = 80;
export const MAX_BODY = 500;

export const audiences: { value: Audience; label: string; detail: string }[] = [
  { value: 'everyone', label: 'Everyone', detail: 'Members and staff' },
  { value: 'members', label: 'Members', detail: 'Only members' },
  { value: 'staff', label: 'Staff', detail: 'Trainers, supervisors and owners' },
];

export function isAudience(value: unknown): value is Audience {
  return audiences.some((a) => a.value === value);
}

/** Ready-made titles for what gyms announce most. */
export const announcementTemplates = [
  'Gym closed for the holiday',
  'New timings',
  'Special offer',
  'New class this week',
] as const;

/** Whether an announcement for this audience is meant for someone with this role. */
export function reaches(audience: Audience, role: Role) {
  if (audience === 'everyone') return true;
  return audience === 'members' ? role === 'member' : role !== 'member';
}

/** Owners and supervisors see everything their gym posted; everyone else, what's meant for them. */
export function visibleTo(announcements: Announcement[], role: Role) {
  return canManageGym(role)
    ? announcements
    : announcements.filter((a) => reaches(a.audience, role));
}

export function audienceLabel(audience: Audience) {
  return audiences.find((a) => a.value === audience)?.label ?? audience;
}

export function announcementProblem(input: AnnouncementInput) {
  if (!input.title.trim()) return 'Add a title.';
  if (input.title.trim().length > MAX_TITLE) return `Keep the title under ${MAX_TITLE} characters.`;
  if (input.body.trim().length > MAX_BODY) return `Keep the message under ${MAX_BODY} characters.`;
  return null;
}

/** The newest announcement from the last few days, to show on the home screen. */
export function latestRecent(announcements: Announcement[], days = 7, now = new Date()) {
  const since = now.getTime() - days * 24 * 60 * 60 * 1000;
  return announcements.find((a) => new Date(a.createdAt).getTime() >= since) ?? null;
}
