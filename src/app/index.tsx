import { Redirect } from 'expo-router';

import { selectActiveGym, selectInAdmin, useAuthStore } from '@/features/auth/auth-store';

export default function Index() {
  const status = useAuthStore((s) => s.status);
  const role = useAuthStore((s) => selectActiveGym(s)?.role);
  const needsPassword = useAuthStore((s) => s.needsPassword);
  const inAdmin = useAuthStore(selectInAdmin);

  if (status !== 'signedIn') return <Redirect href="/sign-in" />;
  if (needsPassword) return <Redirect href="/set-password" />;
  if (inAdmin) return <Redirect href="/admin" />;
  if (!role) return <Redirect href="/no-gym" />;
  return <Redirect href={`/${role}`} />;
}
