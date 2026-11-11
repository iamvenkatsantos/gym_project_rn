import type { Role } from '@/features/auth/types';

/** An open invite from a gym to someone who already has a CoreFit account. */
export type GymInvite = {
  id: string;
  gymId: string;
  gymName: string;
  gymCity: string | null;
  role: Role;
  invitedByName: string | null;
  createdAt: string;
  /** Gyms joining this one moves them out of (comma-separated), or null. */
  leavingGyms: string | null;
  /** Membership days they'd give up at those gyms. */
  daysLeft: number;
};

/** Someone who moved out of a gym by joining another. */
export type MovedMember = {
  userId: string;
  fullName: string;
  phone: string | null;
  movedAt: string | null;
  daysLeft: number;
};
