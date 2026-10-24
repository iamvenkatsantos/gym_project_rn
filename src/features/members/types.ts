import type { Role } from '@/features/auth/types';

/** Someone with the member role at a gym. */
export type GymMember = {
  id: string;
  fullName: string;
};

export type MemberStatus = 'active' | 'invited' | 'suspended';

/** Anyone at a gym, as the owner sees them. */
export type GymPerson = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  status: MemberStatus;
  joinedAt: string;
};

/** An invite waiting for someone to confirm an account with that email. */
export type GymInvite = {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
};

export type InviteResult = 'added' | 'invited' | 'already_member';

export type PeopleFilter = 'all' | Role | 'suspended';

/** A member a trainer coaches through an assigned plan. */
export type CoachedMember = GymMember & { plans: string[] };
