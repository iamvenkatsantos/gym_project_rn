import { parseBirthDate, validateBirthDate } from '@/features/birthdays/rules';
import { parseMetric, validateMetric } from '@/features/body/rules';
import type { PhotoPose } from '@/features/body/types';
import { normalizePhone } from '@/features/enquiries/rules';
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
  const missing = ONBOARDING_POSES.filter((p) => !posesWithPhoto.has(p.value)).map((p) =>
    p.label.toLowerCase(),
  );
  return {
    fullName: validateName(texts.fullName, 'full name'),
    phone: validatePhone(texts.phone),
    dateOfBirth: validateBirthDate(texts.dateOfBirth, { required: true }),
    weight: texts.weight.trim() ? validateMetric(texts.weight, 'weightKg') : 'Enter your weight.',
    height: texts.height.trim() ? validateMetric(texts.height, 'heightCm') : 'Enter your height.',
    photos: missing.length
      ? `Add your ${joinWords(missing)} photo${missing.length > 1 ? 's' : ''}.`
      : null,
  };
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

function joinWords(words: string[]) {
  if (words.length < 2) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}
