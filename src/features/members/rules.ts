import { canCoach, type Role } from '@/features/auth/types';
import type { GymPerson, PeopleFilter } from '@/features/members/types';
import { normalizeEmail, validateEmail } from '@/lib/validation';

export { normalizeEmail };

export type MemberKind = 'member' | 'coach';

/** Roles that can coach members. Trainers first, since that's their whole job. */
export const coachRoles: Role[] = ['trainer', 'supervisor', 'owner'];

/** Coaches with trainers first, then by name. Members just sort by name. */
export function sortCoaches<T extends { fullName: string; role: Role }>(people: T[]) {
  return [...people].sort(
    (a, b) =>
      coachRoles.indexOf(a.role) - coachRoles.indexOf(b.role) ||
      a.fullName.localeCompare(b.fullName),
  );
}

/** Active people who can coach, for trainer pickers. */
export function activeCoaches(people: GymPerson[]) {
  return sortCoaches(people.filter((p) => p.status === 'active' && canCoach(p.role)));
}

/** A coach's name for a picker; owners and supervisors say so, and the viewer is "You". */
export function coachLabel(coach: { id: string; fullName: string; role: Role }, viewerId?: string) {
  if (coach.id === viewerId) return 'You';
  return coach.role === 'trainer' ? coach.fullName : `${coach.fullName} (${coach.role})`;
}

export function isValidEmail(email: string) {
  return validateEmail(email) === null;
}

export function filterPeople(people: GymPerson[], filter: PeopleFilter, query = '') {
  const q = query.trim().toLowerCase();
  return people.filter(
    (p) =>
      (filter === 'all' ||
        (filter === 'suspended'
          ? p.status === 'suspended'
          : p.role === filter && p.status !== 'suspended')) &&
      (!q || p.fullName.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)),
  );
}

export function countPeople(people: GymPerson[]): Record<PeopleFilter, number> {
  const counts: Record<PeopleFilter, number> = {
    all: people.length,
    member: 0,
    trainer: 0,
    supervisor: 0,
    owner: 0,
    suspended: 0,
  };
  for (const p of people) {
    if (p.status === 'suspended') counts.suspended += 1;
    else counts[p.role] += 1;
  }
  return counts;
}

/**
 * True when this person is the gym's only active owner. The database refuses
 * to demote, suspend or remove them; the UI explains why instead of failing.
 */
export function isLastActiveOwner(people: GymPerson[], userId: string) {
  const owners = people.filter((p) => p.role === 'owner' && p.status === 'active');
  return owners.length === 1 && owners[0].id === userId;
}
