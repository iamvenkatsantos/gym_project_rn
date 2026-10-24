import { Redirect } from 'expo-router';

import { selectActiveGym, useAuthStore } from '@/features/auth/auth-store';

export default function Index() {
  const status = useAuthStore((s) => s.status);
  const role = useAuthStore((s) => selectActiveGym(s)?.role);

  if (status !== 'signedIn') return <Redirect href="/sign-in" />;
  if (!role) return <Redirect href="/no-gym" />;
  return <Redirect href={`/${role}`} />;
}
