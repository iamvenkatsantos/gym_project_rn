import type { ImagePickerOptions } from 'expo-image-picker';

import { parseBirthDate, validateBirthDate } from '@/features/birthdays/rules';
import { normalizePhone } from '@/features/enquiries/rules';
import { firstError, validateName, validatePhone } from '@/lib/validation';

/** Square and small: a profile photo only ever shows as a circle. */
export const AVATAR_PICKER_OPTIONS: ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.5,
};

export type ProfileTexts = { fullName: string; phone: string; dateOfBirth: string };

export type ProfileErrors = Record<keyof ProfileTexts, string | null>;

/** Name and mobile are required for everyone; the photo and date of birth are optional. */
export function validateProfile(texts: ProfileTexts): ProfileErrors {
  return {
    fullName: validateName(texts.fullName, 'full name'),
    phone: texts.phone.trim() ? validatePhone(texts.phone) : 'Enter your mobile number.',
    dateOfBirth: validateBirthDate(texts.dateOfBirth),
  };
}

export function firstProfileError(errors: ProfileErrors) {
  return firstError(errors.fullName, errors.phone, errors.dateOfBirth);
}

/** The typed values, cleaned up for saving. Only call once validateProfile passes. */
export function profileValues(texts: ProfileTexts) {
  return {
    fullName: texts.fullName.trim().replace(/\s+/g, ' '),
    phone: normalizePhone(texts.phone),
    dateOfBirth: texts.dateOfBirth.trim() ? parseBirthDate(texts.dateOfBirth) : null,
  };
}
