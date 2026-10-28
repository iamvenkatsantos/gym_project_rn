import { canCoach, canManageGym } from '@/features/auth/types';
import {
  assignableMembers,
  changesLabel,
  membersOf,
  membersToMatch,
  openRequest,
  pendingRequests,
  pickChanges,
  requestProblem,
  toggle,
  trainerSummary,
  trainersOf,
  unmappedMembers,
} from '@/features/coaching/rules';
import type { TrainerLink, TrainerRequest } from '@/features/coaching/types';
import type { GymPerson } from '@/features/members/types';

const person = (
  id: string,
  role: GymPerson['role'],
  status: GymPerson['status'] = 'active',
): GymPerson => ({
  id,
  fullName: id,
  email: `${id}@example.com`,
  role,
  status,
  joinedAt: '2026-01-01',
});

const link = (memberId: string, trainerId: string): TrainerLink => ({
  memberId,
  memberName: memberId,
  trainerId,
  trainerName: trainerId,
  assignedAt: '2026-10-01',
});

const request = (
  id: string,
  memberId: string,
  status: TrainerRequest['status'],
  createdAt: string,
): TrainerRequest => ({
  id,
  memberId,
  memberName: memberId,
  trainerId: null,
  trainerName: null,
  needs: ['Strength'],
  comments: '',
  status,
  response: '',
  createdAt,
  resolvedAt: null,
});

const links = [link('maya', 'tom'), link('maya', 'divya'), link('arjun', 'tom')];

describe('trainer mapping', () => {
  it('lists every trainer of a member and every member of a trainer', () => {
    expect(trainersOf(links, 'maya').map((l) => l.trainerId)).toEqual(['tom', 'divya']);
    expect(membersOf(links, 'tom').map((l) => l.memberId)).toEqual(['maya', 'arjun']);
    expect(membersOf(links, 'nobody')).toEqual([]);
  });

  it('finds active members with no trainer', () => {
    const people = [
      person('maya', 'member'),
      person('priya', 'member'),
      person('rahul', 'member', 'suspended'),
      person('tom', 'trainer'),
    ];
    expect(unmappedMembers(people, links).map((p) => p.id)).toEqual(['priya']);
  });
});

describe('trainer requests', () => {
  const requests = [
    request('r3', 'leo', 'pending', '2026-10-03'),
    request('r1', 'priya', 'approved', '2026-10-01'),
    request('r2', 'maya', 'pending', '2026-10-02'),
  ];

  it('keeps pending requests, oldest first', () => {
    expect(pendingRequests(requests).map((r) => r.id)).toEqual(['r2', 'r3']);
  });

  it('finds a member’s open request', () => {
    expect(openRequest(requests, 'maya')?.id).toBe('r2');
    expect(openRequest(requests, 'priya')).toBeNull();
  });

  it('needs at least one need and short comments', () => {
    expect(requestProblem({ trainerId: null, needs: [], comments: '' })).toMatch(/at least one/);
    expect(
      requestProblem({ trainerId: null, needs: ['Strength'], comments: 'x'.repeat(501) }),
    ).toMatch(/under 500/);
    expect(requestProblem({ trainerId: 'tom', needs: ['Strength'], comments: 'Mornings' })).toBe(
      null,
    );
  });

  it('toggles a need on and off', () => {
    expect(toggle(['Strength'], 'Mobility')).toEqual(['Strength', 'Mobility']);
    expect(toggle(['Strength', 'Mobility'], 'Strength')).toEqual(['Mobility']);
  });
});

describe('roles', () => {
  it('lets owners and supervisors manage the gym', () => {
    expect(canManageGym('owner')).toBe(true);
    expect(canManageGym('supervisor')).toBe(true);
    expect(canManageGym('trainer')).toBe(false);
    expect(canManageGym('member')).toBe(false);
  });

  it('lets owners and supervisors coach as well as trainers', () => {
    expect(canCoach('owner')).toBe(true);
    expect(canCoach('supervisor')).toBe(true);
    expect(canCoach('trainer')).toBe(true);
    expect(canCoach('member')).toBe(false);
  });
});

describe('assigning plans', () => {
  const coached = [{ id: 'maya', fullName: 'Maya' }];
  const people = [
    person('arjun', 'member'),
    person('maya', 'member'),
    person('bea', 'member'),
    person('gone', 'member', 'suspended'),
    { ...person('new', 'member'), signedUp: false },
    person('tom', 'trainer'),
  ];

  it('lists a coach’s own members, then other active, joined members for managers', () => {
    expect(assignableMembers(coached, people)).toEqual([
      { id: 'maya', fullName: 'Maya', coached: true },
      { id: 'arjun', fullName: 'arjun', coached: false },
      { id: 'bea', fullName: 'bea', coached: false },
    ]);
  });

  it('only lists a trainer’s own members', () => {
    expect(assignableMembers(coached)).toEqual([{ id: 'maya', fullName: 'Maya', coached: true }]);
  });
});

describe('matching trainers', () => {
  const people = [
    person('cara', 'member'),
    person('arjun', 'member'),
    person('bea', 'member'),
    person('gone', 'member', 'suspended'),
    { ...person('new', 'member'), signedUp: false },
    person('tom', 'trainer'),
  ];
  const links = [link('arjun', 'tom'), link('arjun', 'sue')];

  it('lists active, joined members without a trainer first, then by name', () => {
    expect(membersToMatch(people, links).map((p) => p.id)).toEqual(['bea', 'cara', 'arjun']);
  });

  it('searches by name or email', () => {
    expect(membersToMatch(people, links, ' BEA@').map((p) => p.id)).toEqual(['bea']);
  });

  it('sums up a member’s trainers, leaving one out when asked', () => {
    expect(trainerSummary(links, 'arjun')).toBe('Trainer: tom, sue');
    expect(trainerSummary(links, 'arjun', 'tom')).toBe('Trainer: sue');
    expect(trainerSummary(links, 'bea')).toBe('No trainer yet');
  });

  it('works out what Save adds and removes', () => {
    expect(pickChanges(['a', 'b'], ['b', 'c', 'd'])).toEqual({ added: ['c', 'd'], removed: ['a'] });
    expect(pickChanges(['a'], ['a'])).toEqual({ added: [], removed: [] });
  });

  it('labels the Save button with the changes', () => {
    expect(changesLabel({ added: ['c', 'd'], removed: ['a'] })).toBe('Save 3 changes');
    expect(changesLabel({ added: [], removed: ['a'] })).toBe('Save 1 change');
    expect(changesLabel({ added: [], removed: [] })).toBe('No changes');
  });
});
