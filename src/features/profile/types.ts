import type { PickedPhoto } from '@/features/onboarding/types';

/** What the profile form saves. */
export type ProfileDetails = { fullName: string; phone: string; avatarPath: string | null };

/** The profile form's input: a newly picked photo, null to remove it, or undefined to keep it. */
export type ProfileInput = { fullName: string; phone: string; photo?: PickedPhoto | null };
