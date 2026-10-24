import type { GymPerson, PeopleFilter } from '@/features/members/types';

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Loose on purpose: the confirmation email is the real check. */
export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
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
