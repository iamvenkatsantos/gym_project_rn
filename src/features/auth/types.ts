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
};

export type Profile = {
  id: string;
  fullName: string;
  gyms: GymRole[];
};
