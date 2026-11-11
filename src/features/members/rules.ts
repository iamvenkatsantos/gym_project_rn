import { canCoach, type Role } from '@/features/auth/types';
import { isMobileLogin, loginLabel } from '@/lib/mobile-login';
import type {
  GymInvite,
  GymPerson,
  InviteResult,
  InviteRole,
  PeopleFilter,
  ResendChannel,
  ResendOutcome,
} from '@/features/members/types';
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

/**
 * The install link in messages. vinven.net/app (web/worker) sends Android to Google Play and
 * iPhones to the App Store (the home page until the iOS app is live).
 */
export const INSTALL_URL = 'https://vinven.net/app';

const JOIN_PAGE_URL = 'https://vinven.net/join';

const inviteAs: Record<InviteRole, string> = {
  member: 'a member',
  trainer: 'a trainer',
  supervisor: 'a supervisor',
  owner: 'a co-owner',
  gym_owner: 'the owner',
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
  // Invites without an email sign in with the mobile number.
  const signInWith = isMobileLogin(email) ? `your mobile number ${loginLabel(email)}` : email;
  if (result === 'added') {
    return [
      `Hi! You've been added to ${gymName} on CoreFit as ${inviteAs[role]}.`,
      '',
      `Open CoreFit and sign in with ${signInWith}. Don't have the app? ${INSTALL_URL}`,
    ].join('\n');
  }
  if (result === 'invited_in_app') {
    return [
      `Hi! You're invited to join ${gymName} on CoreFit as ${inviteAs[role]}.`,
      '',
      `Open CoreFit, sign in with ${signInWith} and tap Join on the invite.`,
    ].join('\n');
  }
  if (code) {
    return [
      `Hi! You're invited to join ${gymName} on CoreFit as ${inviteAs[role]}.`,
      '',
      `1. Install CoreFit: ${INSTALL_URL}`,
      `2. Tap this link: ${joinLink(code)}`,
      `   Or tap "I have an invite code" and enter ${formatInviteCode(code)}`,
      '3. Add your name and a password.',
      '',
      `You'll sign in with ${signInWith}. The code works once, for 7 days.`,
    ].join('\n');
  }
  return [
    `Hi! You're invited to join ${gymName} on CoreFit as ${inviteAs[role]}.`,
    '',
    `1. Install CoreFit: ${INSTALL_URL}`,
    `2. Tap Create account and use this email: ${email}`,
    '3. Enter the 6-digit code from the email.',
    '',
    `You'll be in ${gymName} as soon as you confirm.`,
  ].join('\n');
}

/** The WhatsApp message carrying a password reset code for a mobile sign-in. */
export function resetCodeMessage(gymName: string, code: string) {
  return [
    `Your ${gymName} password reset code on CoreFit: ${formatInviteCode(code)}`,
    '',
    'Open CoreFit, type your mobile number, tap Forgot password? then I have a reset code.',
    'The code works once, for a day.',
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
 * The tappable link in a WhatsApp invite (WhatsApp only links https). On iPhone it opens the app
 * as a universal link; otherwise vinven.net/join (web/worker) opens corefit://join?code=… or the store.
 */
export function joinLink(code: string) {
  return `${JOIN_PAGE_URL}?code=${normalizeInviteCode(code)}`;
}

/** Imported members and people mid-invite have no confirmed account yet. */
/** Whether a WhatsApp invite's join code has run out. */
export function isCodeExpired(invite: Pick<GymInvite, 'codeExpiresAt'>, now = new Date()) {
  return !!invite.codeExpiresAt && new Date(invite.codeExpiresAt) < now;
}

/**
 * How a pending invite resends: WhatsApp invites (they have a code) send the code again,
 * the rest email again. A mobile login has no inbox, so it always goes on WhatsApp.
 */
export function resendChannel(invite: Pick<GymInvite, 'code' | 'email'>): ResendChannel {
  return invite.code || isMobileLogin(invite.email) ? 'whatsapp' : 'email';
}

/** The second line of a pending invite: its role, then where its invite stands. */
export function inviteStatus(
  invite: Pick<
    GymInvite,
    'role' | 'code' | 'codeExpiresAt' | 'emailTriedAt' | 'emailError' | 'email' | 'createdAt'
  >,
  now = new Date(),
) {
  const role = invite.role[0].toUpperCase() + invite.role.slice(1);
  if (resendChannel(invite) === 'whatsapp') {
    if (!invite.code) return `${role} · no code yet, tap resend`;
    if (isCodeExpired(invite, now)) return `${role} · code expired, tap resend`;
    return `${role} · code ${formatInviteCode(invite.code)}`;
  }
  if (invite.emailError) return `${role} · email failed, tap resend`;
  if (invite.emailTriedAt) {
    const day = new Date(invite.emailTriedAt);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return day >= today ? `${role} · emailed today` : `${role} · emailed ${shortDate(day)}`;
  }
  return `${role} · invited ${shortDate(new Date(invite.createdAt))}`;
}

function shortDate(date: Date) {
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** What to tell the inviter after Resend. */
export function resendNotice(outcome: ResendOutcome, channel: ResendChannel) {
  if (outcome.result === 'already_member') return 'They’ve already joined.';
  if (outcome.result === 'invited_in_app')
    return 'They have an account. Sent to their CoreFit inbox.';
  if (channel === 'whatsapp') return null;
  if (outcome.emailSent) return 'Email sent with a new code.';
  return outcome.emailError ?? 'The email didn’t go. Try again later.';
}

export function isSignedUp(person: Pick<GymPerson, 'signedUp'>) {
  return person.signedUp !== false;
}
