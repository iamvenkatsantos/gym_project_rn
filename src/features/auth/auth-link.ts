export type LinkSession = {
  /** invite and recovery still need a password; signup is a confirmed new account. */
  type: 'invite' | 'recovery' | 'signup';
  accessToken: string;
  refreshToken: string;
};

export type AuthLink = { session: LinkSession } | { error: string };

/**
 * Reads an invite, password reset or email confirmation link. Supabase sends people back with the
 * session, or why it failed (such as an expired link), in the URL fragment.
 * Returns null for any other link.
 */
export function parseAuthLink(url: string): AuthLink | null {
  const hash = url.indexOf('#');
  if (hash < 0) return null;
  const params = new URLSearchParams(url.slice(hash + 1));

  const error = params.get('error_description');
  if (error) return { error };

  const type = params.get('type');
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;
  if (type !== 'invite' && type !== 'recovery' && type !== 'signup') return null;
  return { session: { type, accessToken, refreshToken } };
}
