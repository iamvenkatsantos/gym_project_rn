import {
  countPeople,
  filterPeople,
  isLastActiveOwner,
  isValidEmail,
  normalizeEmail,
} from '@/features/members/rules';
import type { GymPerson } from '@/features/members/types';

const person = (
  id: string,
  fullName: string,
  role: GymPerson['role'],
  status: GymPerson['status'] = 'active',
): GymPerson => ({
  id,
  fullName,
  email: `${id}@example.com`,
  role,
  status,
  joinedAt: '2026-01-01',
});

const people = [
  person('olivia', 'Olivia Owner', 'owner'),
  person('tom', 'Tom Trainer', 'trainer'),
  person('maya', 'Maya Member', 'member'),
  person('rahul', 'Rahul Verma', 'member', 'suspended'),
];

describe('member rules', () => {
  it('normalizes and loosely validates emails', () => {
    expect(normalizeEmail('  Maya@Example.COM ')).toBe('maya@example.com');
    expect(isValidEmail(' maya@example.com ')).toBe(true);
    expect(isValidEmail('maya@example')).toBe(false);
    expect(isValidEmail('maya example.com')).toBe(false);
  });

  it('filters by role, keeping suspended people in their own group', () => {
    const ids = (list: GymPerson[]) => list.map((p) => p.id);
    expect(ids(filterPeople(people, 'all'))).toEqual(['olivia', 'tom', 'maya', 'rahul']);
    expect(ids(filterPeople(people, 'member'))).toEqual(['maya']);
    expect(ids(filterPeople(people, 'suspended'))).toEqual(['rahul']);
  });

  it('searches names and emails', () => {
    expect(filterPeople(people, 'all', 'TRAIN').map((p) => p.id)).toEqual(['tom']);
    expect(filterPeople(people, 'all', 'rahul@').map((p) => p.id)).toEqual(['rahul']);
  });

  it('counts each group', () => {
    expect(countPeople(people)).toEqual({ all: 4, member: 1, trainer: 1, owner: 1, suspended: 1 });
  });

  it('spots the last active owner', () => {
    expect(isLastActiveOwner(people, 'olivia')).toBe(true);
    expect(isLastActiveOwner(people, 'tom')).toBe(false);
    const twoOwners = [...people, person('sam', 'Sam Second', 'owner')];
    expect(isLastActiveOwner(twoOwners, 'olivia')).toBe(false);
    const suspendedSecond = [...people, person('sam', 'Sam Second', 'owner', 'suspended')];
    expect(isLastActiveOwner(suspendedSecond, 'olivia')).toBe(true);
  });
});
