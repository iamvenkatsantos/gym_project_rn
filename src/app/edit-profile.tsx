import { router } from 'expo-router';

import { Screen } from '@/components/screen';
import { ProfileForm } from '@/features/profile/components/profile-form';

/** Change your photo, name or mobile, from Profile or Account. */
export default function EditProfileScreen() {
  return (
    <Screen refreshable={false}>
      <ProfileForm submitLabel="Save" onSaved={() => router.back()} />
    </Screen>
  );
}
