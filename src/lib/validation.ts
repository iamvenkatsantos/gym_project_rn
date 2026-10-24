/**
 * Input rules shared by every form. Each validator returns an error message
 * to show under the field, or null when the value is fine. The database has
 * its own checks; these catch mistakes before a round trip and explain them.
 */

/** Practical email check: one @, no spaces, a dot in the domain, a 2+ letter TLD. */
export const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
/** Letters (any language), spaces, apostrophes, dots and hyphens. */
export const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;
/** Whole rupees or rupees and paise, e.g. 1499 or 1499.50, with optional commas and ₹. */
export const AMOUNT_PATTERN = /^\d{1,7}(\.\d{1,2})?$/;
export const CODE_PATTERN = /^\d{6,10}$/;
/** Indian mobile numbers, with or without +91. */
export const PHONE_PATTERN = /^(\+91[\s-]?)?[6-9]\d{9}$/;

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 72;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return 'Enter an email address.';
  if (value.length > 254 || !EMAIL_PATTERN.test(value)) {
    return 'Enter a valid email, like name@example.com.';
  }
  return null;
}

export function validateName(name: string, label = 'name'): string | null {
  const value = name.trim();
  if (!value) return `Enter a ${label}.`;
  if (value.length < 2) return `The ${label} is too short.`;
  if (value.length > 60) return `Keep the ${label} under 60 characters.`;
  if (!NAME_PATTERN.test(value)) return 'Use letters, spaces, dots, hyphens or apostrophes only.';
  return null;
}

/** Sign-up and new passwords: 8+ characters with at least one letter and one number. */
export function validateNewPassword(password: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (password.length > MAX_PASSWORD) return `Keep it under ${MAX_PASSWORD} characters.`;
  if (/^\s|\s$/.test(password)) return 'Remove spaces at the start or end.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Mix letters and at least one number.';
  }
  return null;
}

export function validatePasswordMatch(password: string, confirm: string): string | null {
  if (!confirm) return 'Type the password again.';
  return password === confirm ? null : 'The passwords don’t match.';
}

export function validateCode(code: string): string | null {
  if (!code) return 'Enter the code from the email.';
  return CODE_PATTERN.test(code) ? null : 'The code is the 6-digit number in the email.';
}

export function validatePhone(phone: string): string | null {
  const value = phone.replace(/\s/g, '');
  if (!value) return 'Enter a phone number.';
  return PHONE_PATTERN.test(value) ? null : 'Enter a 10-digit mobile number.';
}

/** Rupee amounts in paise, or null when the text isn't a valid amount. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[,\s₹]/g, '');
  if (!AMOUNT_PATTERN.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export function validateAmount(
  text: string,
  { label = 'amount', allowZero = false, max = 10_000_000 } = {},
): string | null {
  if (!text.trim()) return `Enter the ${label}.`;
  const paise = parseAmount(text);
  if (paise === null) return `Enter the ${label} in rupees, like 1499 or 1499.50.`;
  if (!allowZero && paise === 0) return `The ${label} must be more than ₹0.`;
  if (paise > max * 100) return `That ${label} looks too large.`;
  return null;
}

/** Required single-line text such as a title or subject. */
export function validateTitle(text: string, { label = 'name', min = 2, max = 80 } = {}) {
  const value = text.trim();
  if (!value) return `Enter a ${label}.`;
  if (value.length < min) return `The ${label} is too short.`;
  if (value.length > max) return `Keep the ${label} under ${max} characters.`;
  if (!/[\p{L}\p{N}]/u.test(value)) return `The ${label} needs some letters or numbers.`;
  return null;
}

/** Optional free text, e.g. notes and comments. */
export function validateOptionalText(text: string, max: number): string | null {
  return text.trim().length > max ? `Keep this under ${max} characters.` : null;
}

/** Whole numbers in a range, e.g. reps. */
export function validateWholeNumber(text: string, { min = 0, max = 1000, label = 'number' } = {}) {
  if (!/^\d+$/.test(text.trim())) return `Enter a whole ${label}.`;
  const value = Number(text);
  if (value < min || value > max) return `Enter a ${label} from ${min} to ${max}.`;
  return null;
}

/** Decimals with up to 2 places in a range, e.g. kilograms. */
export function validateDecimal(text: string, { min = 0, max = 1000, label = 'number' } = {}) {
  const cleaned = text.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return `Enter the ${label} as a number, like 22.5.`;
  const value = Number(cleaned);
  if (value < min || value > max) return `Enter a ${label} from ${min} to ${max}.`;
  return null;
}

/** The first error among several, for a form's submit button. */
export function firstError(...errors: (string | null | undefined)[]) {
  return errors.find((e): e is string => !!e) ?? null;
}
