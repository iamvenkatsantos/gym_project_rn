import { parseBirthDate, validateBirthDate } from '@/features/birthdays/rules';
import { parseMetric, validateMetric } from '@/features/body/rules';
import type { PhotoPose } from '@/features/body/types';
import type { AdmissionDetails } from '@/features/onboarding/types';
import { normalizePhone } from '@/features/enquiries/rules';
import { parseMobile } from '@/features/members/import-rules';
import { firstError, validateName, validatePhone } from '@/lib/validation';

/** The three starting photos, in the order the gym asks for them. */
export const ONBOARDING_POSES: { value: PhotoPose; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
  { value: 'side', label: 'Side' },
];

export type OnboardingTexts = {
  fullName: string;
  phone: string;
  dateOfBirth: string;
  weight: string;
  height: string;
};

export type OnboardingErrors = Record<keyof OnboardingTexts, string | null> & {
  photos: string | null;
};

/** What's wrong with each field, given which poses have a photo (picked or already uploaded). */
export function validateOnboarding(
  texts: OnboardingTexts,
  posesWithPhoto: ReadonlySet<PhotoPose>,
): OnboardingErrors {
  return {
    fullName: validateName(texts.fullName, 'full name'),
    phone: validatePhone(texts.phone),
    dateOfBirth: validateBirthDate(texts.dateOfBirth, { required: true }),
    weight: texts.weight.trim() ? validateMetric(texts.weight, 'weightKg') : 'Enter your weight.',
    height: texts.height.trim() ? validateMetric(texts.height, 'heightCm') : 'Enter your height.',
    photos: photosError(posesWithPhoto, 'your'),
  };
}

/** "Add your back photo." when a starting photo is missing, else null. */
export function photosError(posesWithPhoto: ReadonlySet<PhotoPose>, whose: 'your' | 'their') {
  const missing = ONBOARDING_POSES.filter((p) => !posesWithPhoto.has(p.value)).map((p) =>
    p.label.toLowerCase(),
  );
  return missing.length
    ? `Add ${whose} ${joinWords(missing)} photo${missing.length > 1 ? 's' : ''}.`
    : null;
}

export function firstOnboardingError(errors: OnboardingErrors) {
  return firstError(
    errors.fullName,
    errors.phone,
    errors.dateOfBirth,
    errors.weight,
    errors.height,
    errors.photos,
  );
}

/** The typed values, cleaned up for saving. Only call once validateOnboarding passes. */
export function onboardingValues(texts: OnboardingTexts) {
  return {
    fullName: texts.fullName.trim().replace(/\s+/g, ' '),
    phone: normalizePhone(texts.phone),
    dateOfBirth: parseBirthDate(texts.dateOfBirth)!,
    weightKg: parseMetric(texts.weight)!,
    heightCm: parseMetric(texts.height)!,
  };
}

/** The member's details as their inviter types them: the form's fields, without photos. */
export type AdmissionTexts = OnboardingTexts;

export type AdmissionErrors = Record<keyof AdmissionTexts, string | null> & {
  photos: string | null;
};

export const EMPTY_ADMISSION: AdmissionTexts = {
  fullName: '',
  phone: '',
  dateOfBirth: '',
  weight: '',
  height: '',
};

/** What's wrong with the details an inviter fills in for a new member. All are needed. */
export function validateAdmission(
  texts: AdmissionTexts,
  posesWithPhoto: ReadonlySet<PhotoPose>,
): AdmissionErrors {
  return {
    fullName: validateName(texts.fullName, 'full name'),
    phone: parseMobile(texts.phone) ? null : 'Enter a 10-digit mobile number.',
    dateOfBirth: texts.dateOfBirth.trim()
      ? validateBirthDate(texts.dateOfBirth)
      : 'Enter their date of birth.',
    weight: texts.weight.trim() ? validateMetric(texts.weight, 'weightKg') : 'Enter their weight.',
    height: texts.height.trim() ? validateMetric(texts.height, 'heightCm') : 'Enter their height.',
    photos: photosError(posesWithPhoto, 'their'),
  };
}

export function firstAdmissionError(errors: AdmissionErrors) {
  return firstError(
    errors.fullName,
    errors.phone,
    errors.dateOfBirth,
    errors.weight,
    errors.height,
    errors.photos,
  );
}

/** The inviter's typed details, cleaned up for saving. Only call once validateAdmission passes. */
export function admissionValues(texts: AdmissionTexts): AdmissionDetails {
  return { ...onboardingValues(texts), phone: parseMobile(texts.phone)! };
}

function joinWords(words: string[]) {
  if (words.length < 2) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}
