import { parseAuthLink } from '@/features/auth/auth-link';

describe('parseAuthLink', () => {
  it('reads the session from an invite link', () => {
    expect(
      parseAuthLink(
        'corefit://set-password#access_token=a.b.c&expires_in=3600&refresh_token=r1&token_type=bearer&type=invite',
      ),
    ).toEqual({ session: { type: 'invite', accessToken: 'a.b.c', refreshToken: 'r1' } });
  });

  it('reads a password reset link opened in Expo Go', () => {
    expect(
      parseAuthLink(
        'exp://192.168.1.4:8081/--/set-password#access_token=t&refresh_token=r&type=recovery',
      ),
    ).toEqual({ session: { type: 'recovery', accessToken: 't', refreshToken: 'r' } });
  });

  it('explains an expired link', () => {
    expect(
      parseAuthLink(
        'corefit://set-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).toEqual({ error: 'Email link is invalid or has expired' });
  });

  it('reads an email confirmation link', () => {
    expect(parseAuthLink('corefit://#access_token=t&refresh_token=r&type=signup')).toEqual({
      session: { type: 'signup', accessToken: 't', refreshToken: 'r' },
    });
  });

  it('ignores other links', () => {
    expect(parseAuthLink('corefit://member')).toBeNull();
    expect(parseAuthLink('corefit://x#access_token=t&refresh_token=r&type=magiclink')).toBeNull();
    expect(parseAuthLink('corefit://x#type=invite')).toBeNull();
  });
});
