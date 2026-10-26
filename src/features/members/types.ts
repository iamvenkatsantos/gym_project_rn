import type { Role } from '@/features/auth/types';

/** An active person at a gym, as anyone there can list them. */
export type GymMember = {
  id: string;
  fullName: string;
  role: Role;
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

/** What inviting did, and whether the invite email went out. */
export type InviteOutcome = {
  result: InviteResult;
  emailSent: boolean;
  /** Why no email went out, when one should have. */
  emailError: string | null;
};

export type PeopleFilter = 'all' | Role | 'suspended';

/** A member mapped to a trainer, with the plans that trainer assigned them. */
export type CoachedMember = { id: string; fullName: string; plans: string[] };
