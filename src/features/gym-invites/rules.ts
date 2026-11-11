import type { GymInvite, MovedMember } from '@/features/gym-invites/types';

const asRole: Record<GymInvite['role'], string> = {
  member: 'a member',
  trainer: 'a trainer',
  supervisor: 'a supervisor',
  owner: 'an owner',
};

/** "Invites you as a member · Anna Nagar · from Kavi" */
export function inviteLine(invite: Pick<GymInvite, 'role' | 'gymCity' | 'invitedByName'>) {
  return [
    `Invites you as ${asRole[invite.role]}`,
    invite.gymCity,
    invite.invitedByName ? `from ${invite.invitedByName}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** "You'll leave Iron Den. Your 20 membership days there end." or null when nothing is left behind. */
export function leaveWarning(invite: Pick<GymInvite, 'leavingGyms' | 'daysLeft'>) {
  if (!invite.leavingGyms) return null;
  const days =
    invite.daysLeft > 0
      ? ` Your ${invite.daysLeft} membership ${invite.daysLeft === 1 ? 'day there ends' : 'days there end'}.`
      : '';
  return `You'll leave ${invite.leavingGyms}.${days}`;
}

/** "Moved 11 Nov · 20 days left" */
export function movedLine(moved: Pick<MovedMember, 'movedAt' | 'daysLeft'>) {
  const date = moved.movedAt
    ? new Date(moved.movedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : null;
  return [
    date ? `Moved ${date}` : 'Moved',
    moved.daysLeft > 0 ? `${moved.daysLeft} day${moved.daysLeft === 1 ? '' : 's'} left` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
