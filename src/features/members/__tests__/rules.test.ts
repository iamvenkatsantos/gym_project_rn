import {
  activeCoaches,
  coachLabel,
  countPeople,
  filterPeople,
  isLastActiveOwner,
  formatInviteCode,
  inviteStatus,
  isCodeExpired,
  resendChannel,
  resendNotice,
  inviteMessage,
  isInviteCode,
  isSignedUp,
  joinLink,
  normalizeInviteCode,
  isValidEmail,
  normalizeEmail,
  resetCodeMessage,
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
  it('asks someone who already uses CoreFit to accept in the app', () => {
    const text = inviteMessage('Iron Den', '9840012345@m.vinven.net', 'member', 'invited_in_app');
    expect(text).toContain("You're invited to join Iron Den on CoreFit as a member.");
    expect(text).toContain('sign in with your mobile number');
    expect(text).toContain('tap Join on the invite');
  });

  it('tells someone new which email to sign up with', () => {
    const text = inviteMessage('Iron Den', 'kavi@mail.com', 'trainer', 'invited');
    expect(text).toContain("You're invited to join Iron Den on CoreFit as a trainer.");
    expect(text).toContain('Tap Create account and use this email: kavi@mail.com');
    expect(text).toContain("You'll be in Iron Den as soon as you confirm.");
  });

  it('invites a new gym owner to the gym the admin set up for them', () => {
    const text = inviteMessage('AMR Fitness', 'raj@mail.com', 'gym_owner', 'invited', 'K7P2QX4M');
    expect(text).toContain("You're invited to join AMR Fitness on CoreFit as the owner.");
    expect(text).toContain('K7P2-QX4M');
  });

  it('tells a new gym owner with an account their gym is ready', () => {
    const text = inviteMessage('AMR Fitness', 'raj@mail.com', 'gym_owner', 'added');
    expect(text).toContain("You've been added to AMR Fitness on CoreFit as the owner.");
    expect(text).toContain('sign in with raj@mail.com');
  });

  it('just says to sign in when they already have an account', () => {
    const text = inviteMessage('Iron Den', 'anu@mail.com', 'member', 'added');
    expect(text).toContain("You've been added to Iron Den on CoreFit as a member.");
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
    expect(joinLink('k7p2-qx4m')).toBe('https://vinven.net/join?code=K7P2QX4M');
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

describe('resetCodeMessage', () => {
  it('carries the formatted code and where to enter it', () => {
    const message = resetCodeMessage('Pulse Fitness', 'K7P2QX4M');
    expect(message).toContain('K7P2-QX4M');
    expect(message).toContain('I have a reset code');
  });
});

describe('pending invite resend', () => {
  const now = new Date('2026-11-11T10:00:00');
  const base = {
    role: 'member' as const,
    email: 'asha@example.com',
    createdAt: '2026-11-09T09:00:00',
    code: null,
    codeExpiresAt: null,
    emailTriedAt: null,
    emailError: null,
  };

  it('emails again unless it has a code or is a mobile login', () => {
    expect(resendChannel(base)).toBe('email');
    expect(resendChannel({ ...base, code: 'K7P2QX4M' })).toBe('whatsapp');
    expect(resendChannel({ ...base, email: '9840012345@m.vinven.net' })).toBe('whatsapp');
  });

  it('says where the invite stands', () => {
    expect(inviteStatus({ ...base, emailError: 'Too many emails' }, now)).toBe(
      'Member · email failed, tap resend',
    );
    expect(inviteStatus({ ...base, emailTriedAt: '2026-11-11T08:00:00' }, now)).toBe(
      'Member · emailed today',
    );
    expect(inviteStatus({ ...base, emailTriedAt: '2026-11-09T08:00:00' }, now)).toMatch(
      /^Member · emailed /,
    );
    expect(inviteStatus(base, now)).toMatch(/^Member · invited /);
    expect(
      inviteStatus({ ...base, code: 'K7P2QX4M', codeExpiresAt: '2026-11-10T00:00:00' }, now),
    ).toBe('Member · code expired, tap resend');
    expect(
      inviteStatus({ ...base, code: 'K7P2QX4M', codeExpiresAt: '2026-11-15T00:00:00' }, now),
    ).toBe('Member · code K7P2-QX4M');
    expect(isCodeExpired({ codeExpiresAt: null }, now)).toBe(false);
  });

  it('tells the inviter what resend did', () => {
    const sent = { result: 'invited' as const, emailSent: true, emailError: null, code: null };
    expect(resendNotice(sent, 'email')).toBe('Email sent with a new code.');
    expect(resendNotice({ ...sent, emailSent: false, emailError: 'Wait a minute' }, 'email')).toBe(
      'Wait a minute',
    );
    expect(resendNotice({ ...sent, result: 'already_member' }, 'email')).toBe(
      'They’ve already joined.',
    );
    expect(resendNotice({ ...sent, result: 'invited_in_app' }, 'whatsapp')).toMatch(/inbox/);
    expect(resendNotice({ ...sent, code: 'K7P2QX4M' }, 'whatsapp')).toBeNull();
  });
});
