import { Redirect } from 'expo-router';

import {
  selectActiveGym,
  selectInAdmin,
  selectNeedsProfile,
  useAuthStore,
} from '@/features/auth/auth-store';

export default function Index() {
  const status = useAuthStore((s) => s.status);
  const role = useAuthStore((s) => selectActiveGym(s)?.role);
  const onboarding = useAuthStore((s) => !!selectActiveGym(s)?.needsOnboarding);
  const needsProfile = useAuthStore(selectNeedsProfile);
  const needsPassword = useAuthStore((s) => s.needsPassword);
  const inAdmin = useAuthStore(selectInAdmin);

  if (status !== 'signedIn') return <Redirect href="/sign-in" />;
  if (needsPassword) return <Redirect href="/set-password" />;
  if (inAdmin) return <Redirect href="/admin" />;
  if (onboarding) return <Redirect href="/onboarding" />;
  if (needsProfile) return <Redirect href="/profile-setup" />;
  if (!role) return <Redirect href="/no-gym" />;
  return <Redirect href={`/${role}`} />;
}
