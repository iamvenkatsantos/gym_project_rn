import { Image } from 'expo-image';
import { useEffect } from 'react';

import { selectActiveGym, useAuthStore } from '@/features/auth/auth-store';
import { brandingFor, useGymBranding } from '@/features/gyms/branding-store';

/**
 * Keeps the phone's copy of the active gym's logo and name current, for the next launch screen.
 * Does nothing while no gym is open (signed out, the admin area), so the last gym stays.
 */
export function useRememberGymBranding() {
  const gym = useAuthStore(selectActiveGym);
  const name = gym?.gymName;
  const logoUrl = gym?.logoUrl;
  const tagline = gym?.tagline;
  const set = useGymBranding((s) => s.set);
  useEffect(() => {
    if (!name) return;
    const next = brandingFor({ gymName: name, logoUrl, tagline });
    set(next);
    if (next) Image.prefetch(next.logoUrl, 'disk').catch(() => {});
  }, [name, logoUrl, tagline, set]);
}
