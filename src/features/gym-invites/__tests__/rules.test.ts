import { inviteLine } from '@/features/gym-invites/rules';

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
