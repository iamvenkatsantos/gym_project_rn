import { selectActiveGym, useAuthStore } from '@/features/auth/auth-store';
import type { Profile } from '@/features/auth/types';

const profile: Profile = {
  id: 'u-1',
  fullName: 'Tom Trainer',
  gyms: [
    { gymId: 'g-1', gymName: 'Anna Nagar', role: 'trainer' },
    { gymId: 'g-2', gymName: 'Velachery', role: 'member' },
  ],
};

beforeEach(() => {
  useAuthStore.setState({ status: 'loading', profile: null, activeGymId: null });
});

describe('auth store', () => {
  it('starts on the first gym and takes the role from it', () => {
    useAuthStore.getState().setProfile(profile);
    expect(selectActiveGym(useAuthStore.getState())).toEqual(profile.gyms[0]);
  });

  it('switches role when the active gym changes', () => {
    useAuthStore.getState().setProfile(profile);
    useAuthStore.getState().setActiveGym('g-2');
    expect(selectActiveGym(useAuthStore.getState())?.role).toBe('member');
  });

  it('keeps the chosen gym on refresh, but drops it if the membership is gone', () => {
    useAuthStore.getState().setProfile(profile);
    useAuthStore.getState().setActiveGym('g-2');
    useAuthStore.getState().setProfile({ ...profile });
    expect(useAuthStore.getState().activeGymId).toBe('g-2');

    useAuthStore.getState().setProfile({ ...profile, gyms: [profile.gyms[0]] });
    expect(useAuthStore.getState().activeGymId).toBe('g-1');
  });

  it('picks up a role change on refresh at the same gym', () => {
    useAuthStore.getState().setProfile(profile);
    useAuthStore
      .getState()
      .setProfile({ ...profile, gyms: [{ ...profile.gyms[0], role: 'owner' }, profile.gyms[1]] });
    expect(selectActiveGym(useAuthStore.getState())?.role).toBe('owner');
  });

  it('has no active gym for someone who belongs to none', () => {
    useAuthStore.getState().setProfile({ ...profile, gyms: [] });
    expect(useAuthStore.getState().status).toBe('signedIn');
    expect(selectActiveGym(useAuthStore.getState())).toBeNull();
  });
});
