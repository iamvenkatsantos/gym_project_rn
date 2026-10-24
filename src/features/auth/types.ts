export type Role = 'member' | 'trainer' | 'owner';

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
