import { router } from 'expo-router';

import { Screen } from '@/components/screen';
import { AddEmail } from '@/features/profile/components/add-email';
import { ProfileForm } from '@/features/profile/components/profile-form';

/** Change your photo, name or mobile, from Profile or Account; mobile sign-ins can add an email. */
export default function EditProfileScreen() {
  return (
    <Screen refreshable={false}>
      <ProfileForm submitLabel="Save" onSaved={() => router.back()} />
      <AddEmail />
    </Screen>
  );
}
