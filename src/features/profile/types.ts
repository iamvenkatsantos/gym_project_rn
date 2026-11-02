import type { PickedPhoto } from '@/features/onboarding/types';

/**
 * What the profile form saves. A date of birth of null removes it; undefined leaves
 * it alone (before the birthdays migration there's nowhere to keep it).
 */
export type ProfileDetails = {
  fullName: string;
  phone: string;
  avatarPath: string | null;
  dateOfBirth?: string | null;
};

/** The profile form's input: a newly picked photo, null to remove it, or undefined to keep it. */
export type ProfileInput = {
  fullName: string;
  phone: string;
  dateOfBirth?: string | null;
  photo?: PickedPhoto | null;
};
