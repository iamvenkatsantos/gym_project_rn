import {
  isMobileLogin,
  isMobileTyped,
  loginLabel,
  mobileLoginEmail,
  signInEmail,
} from '@/lib/mobile-login';

describe('mobile logins', () => {
  it('turns a typed mobile number into its login email', () => {
    expect(signInEmail('98400 12345')).toBe('9840012345@m.vinven.net');
    expect(signInEmail('+91 98400-12345')).toBe('9840012345@m.vinven.net');
    expect(signInEmail('098400 12345')).toBe('9840012345@m.vinven.net');
  });

  it('leaves an email alone', () => {
    expect(signInEmail(' asha@example.com ')).toBe('asha@example.com');
    expect(isMobileTyped('asha@example.com')).toBe(false);
    expect(isMobileTyped('12345')).toBe(false);
  });

  it('shows the mobile number instead of the login email', () => {
    expect(isMobileLogin(mobileLoginEmail('9840012345'))).toBe(true);
    expect(loginLabel('9840012345@m.vinven.net')).toBe('98400 12345');
    expect(loginLabel('asha@example.com')).toBe('asha@example.com');
    expect(loginLabel(null)).toBe('');
  });
});
