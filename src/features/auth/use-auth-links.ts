import * as Linking from 'expo-linking';
import { useEffect } from 'react';

import { signInWithLinkSession } from '@/features/auth/api';
import { parseAuthLink } from '@/features/auth/auth-link';
import { useAuthStore } from '@/features/auth/auth-store';

/**
 * Signs people in from the links in invite, password reset and confirmation
 * emails. Invites, resets and imported members then go to the set-password screen first.
 */
export function useAuthLinks() {
  const url = Linking.useURL();

  useEffect(() => {
    const link = url ? parseAuthLink(url) : null;
    if (!link) return;
    const { setProfile, setNeedsPassword, setLinkError } = useAuthStore.getState();
    if ('error' in link) {
      setLinkError(link.error);
      return;
    }
    setLinkError(null);
    // Set before the session lands so the role screens never flash first.
    setNeedsPassword(link.session.type !== 'signup');
    signInWithLinkSession(link.session)
      .then(({ profile, imported }) => {
        // An imported member confirming their sign-up still has to choose a password.
        if (imported) setNeedsPassword(true);
        setProfile(profile);
      })
      .catch((error: Error) => {
        setNeedsPassword(false);
        setLinkError(error.message);
      });
  }, [url]);
}
