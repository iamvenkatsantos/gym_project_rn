import {
  activeCoaches,
  coachLabel,
  countPeople,
  filterPeople,
  isLastActiveOwner,
  formatInviteCode,
  inviteMessage,
  isInviteCode,
  isSignedUp,
  joinLink,
  normalizeInviteCode,
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
    expect(countPeople(people)).toEqual({
      all: 4,
      member: 1,
      trainer: 1,
      supervisor: 0,
      owner: 1,
      suspended: 1,
    });
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

describe('coaches', () => {
  const staff = [
    person('olivia', 'Olivia Owner', 'owner'),
    person('sam', 'Sam Supervisor', 'supervisor'),
    person('zara', 'Zara Trainer', 'trainer'),
    person('tom', 'Tom Trainer', 'trainer'),
    person('maya', 'Maya Member', 'member'),
    person('rita', 'Rita Trainer', 'trainer', 'suspended'),
  ];

  it('lists active trainers first, then supervisors and owners', () => {
    expect(activeCoaches(staff).map((p) => p.id)).toEqual(['tom', 'zara', 'sam', 'olivia']);
  });

  it('says when a coach is an owner or supervisor, or the viewer', () => {
    expect(coachLabel(staff[3])).toBe('Tom Trainer');
    expect(coachLabel(staff[0])).toBe('Olivia Owner (owner)');
    expect(coachLabel(staff[1], 'sam')).toBe('You');
  });
});

describe('inviteMessage', () => {
  it('tells someone new which email to sign up with', () => {
    const text = inviteMessage('Iron Den', 'kavi@mail.com', 'trainer', 'invited');
    expect(text).toContain("You're invited to join Iron Den on CoreFit Gym as a trainer.");
    expect(text).toContain('Tap Create account and use this email: kavi@mail.com');
    expect(text).toContain("You'll be in Iron Den as soon as you confirm.");
  });

  it('asks a new gym owner to set up their gym', () => {
    const text = inviteMessage('Iron Den', 'raj@mail.com', 'gym_owner', 'invited');
    expect(text).toContain("You're invited to set up your gym on CoreFit Gym.");
    expect(text).not.toContain('Iron Den');
  });

  it('asks a new gym owner with an account to sign in and set up, naming no gym', () => {
    const text = inviteMessage('', 'raj@mail.com', 'gym_owner', 'added');
    expect(text).toContain("You're invited to set up your gym on CoreFit Gym.");
    expect(text).toContain('sign in with raj@mail.com');
    expect(text).not.toContain('added to');
  });

  it('just says to sign in when they already have an account', () => {
    const text = inviteMessage('Iron Den', 'anu@mail.com', 'member', 'added');
    expect(text).toContain("You've been added to Iron Den on CoreFit Gym as a member.");
    expect(text).toContain('sign in with anu@mail.com');
  });
});

describe('invite codes', () => {
  it('reads codes however people type them', () => {
    expect(normalizeInviteCode(' k7p2-qx4m ')).toBe('K7P2QX4M');
    expect(formatInviteCode('k7p2qx4m')).toBe('K7P2-QX4M');
    expect(isInviteCode('K7P2 QX4M')).toBe(true);
    expect(isInviteCode('K7P2QX4')).toBe(false);
    // 0, O, 1 and I are left out so they can't be mixed up.
    expect(isInviteCode('K7P2QX4O')).toBe(false);
  });

  it('links through the join function', () => {
    expect(joinLink('k7p2-qx4m')).toMatch(/\/functions\/v1\/join\?code=K7P2QX4M$/);
  });

  it('puts the link and code in the WhatsApp message', () => {
    const text = inviteMessage('Iron Den', 'kavi@mail.com', 'member', 'invited', 'K7P2QX4M');
    expect(text).toContain('join?code=K7P2QX4M');
    expect(text).toContain('enter K7P2-QX4M');
    expect(text).toContain("You'll sign in with kavi@mail.com.");
    expect(text).not.toContain('6-digit');
  });

  it('treats people as signed up unless told otherwise', () => {
    expect(isSignedUp({})).toBe(true);
    expect(isSignedUp({ signedUp: false })).toBe(false);
  });
});
