import type { PhotoPose } from '@/features/body/types';

/** A photo picked on the phone, not uploaded yet. */
export type PickedPhoto = { uri: string; mimeType: string };

/** The details a member gives on first sign-in, or their inviter gives for them. */
export type AdmissionDetails = {
  fullName: string;
  phone: string;
  /** YYYY-MM-DD. */
  dateOfBirth: string;
  weightKg: number;
  heightCm: number;
};

/** What a new member fills in on first sign-in. */
export type OnboardingInput = AdmissionDetails & {
  /** An optional profile photo, separate from the starting photos. */
  avatar?: PickedPhoto | null;
  /** Photos still to upload; poses already uploaded (say on an earlier try) are left out. */
  photos: Partial<Record<PhotoPose, PickedPhoto>>;
};
