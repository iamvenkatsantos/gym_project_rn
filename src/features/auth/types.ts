export type Role = 'member' | 'trainer' | 'owner';

export type Profile = {
  id: string;
  gymId: string | null;
  fullName: string;
  role: Role;
};
