import { inviteLine, leaveWarning, movedLine } from '@/features/gym-invites/rules';

describe('inviteLine', () => {
  it('names the role, city and inviter', () => {
    expect(inviteLine({ role: 'member', gymCity: 'Chennai', invitedByName: 'Kavi' })).toBe(
      'Invites you as a member · Chennai · from Kavi',
    );
  });

  it("leaves out what it doesn't know", () => {
    expect(inviteLine({ role: 'owner', gymCity: null, invitedByName: null })).toBe(
      'Invites you as an owner',
    );
  });
});

describe('leaveWarning', () => {
  it('names the gyms and the membership days given up', () => {
    expect(leaveWarning({ leavingGyms: 'Iron Den', daysLeft: 20 })).toBe(
      "You'll leave Iron Den. Your 20 membership days there end.",
    );
    expect(leaveWarning({ leavingGyms: 'Iron Den', daysLeft: 1 })).toBe(
      "You'll leave Iron Den. Your 1 membership day there ends.",
    );
  });

  it('skips the days when none are left, and says nothing when no gym is left', () => {
    expect(leaveWarning({ leavingGyms: 'Iron Den', daysLeft: 0 })).toBe("You'll leave Iron Den.");
    expect(leaveWarning({ leavingGyms: null, daysLeft: 0 })).toBeNull();
  });
});

describe('movedLine', () => {
  it('gives the day they moved and the days they gave up', () => {
    expect(movedLine({ movedAt: '2026-11-11T05:00:00Z', daysLeft: 20 })).toBe(
      'Moved 11 Nov · 20 days left',
    );
    expect(movedLine({ movedAt: null, daysLeft: 0 })).toBe('Moved');
  });
});
