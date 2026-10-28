export type Role = 'member' | 'trainer' | 'supervisor' | 'owner';

/** Owners and supervisors run the gym day to day: people, payments and trainer mapping. */
export function canManageGym(role: Role) {
  return role === 'owner' || role === 'supervisor';
}

/**
 * Staff roles nest so small gyms can run without every role: owners can do
 * supervisor and trainer work, and supervisors can do trainer work. Anyone
 * who can coach sets bookable hours, writes plans and is mapped to members.
 */
export function canCoach(role: Role) {
  return role !== 'member';
}

/** A person's role in one gym. The same person can hold different roles in different gyms. */
export type GymRole = {
  gymId: string;
  gymName: string;
  role: Role;
  /** The brand the gym is a branch of. Every gym has one; a single gym is a one-branch brand. */
  brandId?: string;
  brandName?: string;
  /** A member who still has to fill in their details and photos before using the app. */
  needsOnboarding?: boolean;
};

export type Profile = {
  id: string;
  fullName: string;
  /** The profile photo's path in the avatars bucket, and its public link. Optional for everyone. */
  avatarPath?: string | null;
  avatarUrl?: string | null;
  /**
   * Their mobile number, which every role must give. Null when they haven't yet;
   * undefined when it couldn't be read, in which case nobody is asked for it.
   */
  phone?: string | null;
  gyms: GymRole[];
  /** Runs CoreFit Gym itself: sees every owner and branch, and adds branches. */
  isPlatformAdmin?: boolean;
};
