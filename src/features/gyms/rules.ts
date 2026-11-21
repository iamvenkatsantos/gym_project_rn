import type { GymDetails } from '@/features/gyms/types';
import {
  validateContactPhone,
  validateEmail,
  validateOptionalText,
  validateTitle,
} from '@/lib/validation';

export const emptyGymDetails: GymDetails = {
  name: '',
  address: '',
  city: '',
  phone: '',
  email: '',
};

export type GymDetailsErrors = Record<keyof GymDetails, string | null>;

/**
 * The name is required; the phone and email only need to be valid when given.
 * The phone can be a landline, since many gyms list their front-desk number.
 */
export function validateGymDetails(details: GymDetails): GymDetailsErrors {
  return {
    name: validateTitle(details.name, { label: 'gym name', max: 80 }),
    address: validateOptionalText(details.address, 200),
    city: validateOptionalText(details.city, 60),
    phone: details.phone.trim() ? validateContactPhone(details.phone) : null,
    email: details.email.trim() ? validateEmail(details.email) : null,
  };
}

/** Trims every field and lowercases the email, as the database stores them. */
export function cleanGymDetails(details: GymDetails): GymDetails {
  return {
    name: details.name.trim(),
    address: details.address.trim(),
    city: details.city.trim(),
    phone: details.phone.replace(/[\s()-]/g, ''),
    email: details.email.trim().toLowerCase(),
  };
}

/** The longest tagline the server takes (a short line under the gym's name). */
export const MAX_TAGLINE = 60;

/** Trimmed, with runs of spaces collapsed; blank means no tagline. */
export function cleanTagline(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** An error for a tagline that's too long, or null. */
export function validateTagline(text: string): string | null {
  return cleanTagline(text).length > MAX_TAGLINE ? 'Keep it to 60 characters.' : null;
}
