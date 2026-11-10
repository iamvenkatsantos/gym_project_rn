import type { GymInvite } from '@/features/gym-invites/types';

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
