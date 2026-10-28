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
  phone?: string | null;
  /** Their profile photo, if they've added one. */
  avatarUrl?: string | null;
  /** Who invited a member, i.e. admitted them. Null for members from before admissions were kept. */
  admittedByName?: string | null;
  admittedAt?: string | null;
  /** Whether a member has filled in their first-sign-in details. */
  onboarded?: boolean;
};

/** An invite waiting for someone to confirm an account with that email. */
export type GymInvite = {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
};

/** A role at this gym, or 'gym_owner': the owner of a new gym of their own. */
export type InviteRole = Role | 'gym_owner';

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

/** What importing one row did: added to the gym, already here (membership added), or skipped. */
export type ImportOutcome = {
  email: string;
  result: 'added' | 'updated' | 'skipped';
  /** Whether they have confirmed an account, i.e. need no invite email. */
  joined: boolean;
  /** Why a row was skipped, or a note such as an already-imported membership. */
  message: string | null;
};
