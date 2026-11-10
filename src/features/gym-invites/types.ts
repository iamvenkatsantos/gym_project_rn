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
};
