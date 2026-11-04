/**
 * Accounts from a WhatsApp invite without an email sign in with their mobile
 * number. Underneath, the account's email is <10 digits>@m.vinven.net (made by
 * the database's mobile_login_email()), a domain that receives no mail. The app
 * turns a typed mobile number into that address and never shows it.
 */
export const MOBILE_LOGIN_DOMAIN = 'm.vinven.net';

/** "98400 12345", "+91 98400-12345" or "098400 12345" as 10 digits, else null. */
function tenDigitMobile(text: string): string | null {
  const match = text.replace(/[\s()-]/g, '').match(/^(?:\+91|91|0)?([6-9]\d{9})$/);
  return match ? match[1] : null;
}

export function mobileLoginEmail(mobile: string) {
  return `${mobile}@${MOBILE_LOGIN_DOMAIN}`;
}

export function isMobileLogin(email: string | null | undefined) {
  return !!email && email.toLowerCase().endsWith(`@${MOBILE_LOGIN_DOMAIN}`);
}

/** What someone types on sign in, as the email to sign in with: a mobile number or an email. */
export function signInEmail(typed: string) {
  const mobile = tenDigitMobile(typed);
  return mobile ? mobileLoginEmail(mobile) : typed.trim();
}

/** Whether what's typed on sign in is a mobile number rather than an email. */
export function isMobileTyped(typed: string) {
  return tenDigitMobile(typed) !== null;
}

/** How to show an account's email: the real one, or the mobile number it signs in with. */
export function loginLabel(email: string | null | undefined) {
  if (!email) return '';
  if (!isMobileLogin(email)) return email;
  const digits = email.split('@')[0];
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}
