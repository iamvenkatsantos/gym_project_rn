import { Redirect } from 'expo-router';

import { useAuthStore } from '@/features/auth/auth-store';

export default function Index() {
  const role = useAuthStore((s) => s.profile?.role);

  if (!role) return <Redirect href="/sign-in" />;
  return <Redirect href={`/${role}`} />;
}
