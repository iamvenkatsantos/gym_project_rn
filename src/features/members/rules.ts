import { canCoach, type Role } from '@/features/auth/types';
import type { GymPerson, InviteResult, InviteRole, PeopleFilter } from '@/features/members/types';
import { env } from '@/lib/env';
import { normalizeEmail, validateEmail } from '@/lib/validation';

export { normalizeEmail };

export type MemberKind = 'member' | 'coach';

/** Roles that can coach members. Trainers first, since that's their whole job. */
export const coachRoles: Role[] = ['trainer', 'supervisor', 'owner'];

/** Coaches with trainers first, then by name. Members just sort by name. */
export function sortCoaches<T extends { fullName: string; role: Role }>(people: T[]) {
  return [...people].sort(
    (a, b) =>
      coachRoles.indexOf(a.role) - coachRoles.indexOf(b.role) ||
      a.fullName.localeCompare(b.fullName),
  );
}

/** Active people who can coach, for trainer pickers. */
export function activeCoaches(people: GymPerson[]) {
  return sortCoaches(
    people.filter((p) => p.status === 'active' && isSignedUp(p) && canCoach(p.role)),
  );
}

/** A coach's name for a picker; owners and supervisors say so, and the viewer is "You". */
export function coachLabel(coach: { id: string; fullName: string; role: Role }, viewerId?: string) {
  if (coach.id === viewerId) return 'You';
  return coach.role === 'trainer' ? coach.fullName : `${coach.fullName} (${coach.role})`;
}

export function isValidEmail(email: string) {
  return validateEmail(email) === null;
}

export function filterPeople(people: GymPerson[], filter: PeopleFilter, query = '') {
  const q = query.trim().toLowerCase();
  return people.filter(
    (p) =>
      (filter === 'all' ||
        (filter === 'suspended'
          ? p.status === 'suspended'
          : p.role === filter && p.status !== 'suspended')) &&
      (!q || p.fullName.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)),
  );
}

export function countPeople(people: GymPerson[]): Record<PeopleFilter, number> {
  const counts: Record<PeopleFilter, number> = {
    all: people.length,
    member: 0,
    trainer: 0,
    supervisor: 0,
    owner: 0,
    suspended: 0,
  };
  for (const p of people) {
    if (p.status === 'suspended') counts.suspended += 1;
    else counts[p.role] += 1;
  }
  return counts;
}

/**
 * True when this person is the gym's only active owner. The database refuses
 * to demote, suspend or remove them; the UI explains why instead of failing.
 */
export function isLastActiveOwner(people: GymPerson[], userId: string) {
  const owners = people.filter((p) => p.role === 'owner' && p.status === 'active');
  return owners.length === 1 && owners[0].id === userId;
}

/** CoreFit Gym on Google Play. It opens once the app is listed there. */
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.corefit.gym';

const inviteAs: Record<InviteRole, string> = {
  member: 'a member',
  trainer: 'a trainer',
  supervisor: 'a supervisor',
  owner: 'a co-owner',
  gym_owner: 'an owner',
};

/**
 * The WhatsApp message for an invite saved without an email. Creating an account with the
 * invited email claims it, so the message only has to say which email to use.
 */
export function inviteMessage(
  gymName: string,
  email: string,
  role: InviteRole,
  result: InviteResult,
  code?: string | null,
) {
  if (result === 'added') {
    return [
      `Hi! You've been added to ${gymName} on CoreFit Gym as ${inviteAs[role]}.`,
      '',
      `Open CoreFit Gym and sign in with ${email}. Don't have the app? ${PLAY_STORE_URL}`,
    ].join('\n');
  }
  if (code) {
    return [
      `Hi! You're invited to join ${gymName} on CoreFit Gym as ${inviteAs[role]}.`,
      '',
      `1. Install CoreFit Gym: ${PLAY_STORE_URL}`,
      `2. Tap this link: ${joinLink(code)}`,
      `   Or tap "I have an invite code" and enter ${formatInviteCode(code)}`,
      '3. Add your name and a password.',
      '',
      `You'll sign in with ${email}. The code works once, for 7 days.`,
    ].join('\n');
  }
  return [
    role === 'gym_owner'
      ? "Hi! You're invited to set up your gym on CoreFit Gym."
      : `Hi! You're invited to join ${gymName} on CoreFit Gym as ${inviteAs[role]}.`,
    '',
    `1. Install CoreFit Gym: ${PLAY_STORE_URL}`,
    `2. Tap Create account and use this email: ${email}`,
    '3. Enter the 6-digit code from the email.',
    '',
    role === 'gym_owner'
      ? "Then add your gym's details and you're ready to go."
      : `You'll be in ${gymName} as soon as you confirm.`,
  ].join('\n');
}

/** "K7P2QX4M" as "K7P2-QX4M", easier to read out and type. */
export function formatInviteCode(code: string) {
  const clean = normalizeInviteCode(code);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

/** What people type, as the database stores it: no dashes or spaces, upper case. */
export function normalizeInviteCode(text: string) {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Invite codes are 8 letters and digits, without 0, O, 1 or I. */
export function isInviteCode(text: string) {
  return /^[A-HJ-NP-Z2-9]{8}$/.test(normalizeInviteCode(text));
}

/**
 * The tappable link in a WhatsApp invite. WhatsApp only links https, so it goes
 * through the join function, which opens corefit://join?code=… or the Play Store.
 */
export function joinLink(code: string) {
  return `${env.supabaseUrl}/functions/v1/join?code=${normalizeInviteCode(code)}`;
}

/** Imported members and people mid-invite have no confirmed account yet. */
export function isSignedUp(person: Pick<GymPerson, 'signedUp'>) {
  return person.signedUp !== false;
}
