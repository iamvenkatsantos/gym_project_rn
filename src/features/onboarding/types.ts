import type { PhotoPose } from '@/features/body/types';

/** A photo picked on the phone, not uploaded yet. */
export type PickedPhoto = { uri: string; mimeType: string };

/** What a new member fills in on first sign-in. */
export type OnboardingInput = {
  fullName: string;
  phone: string;
  /** YYYY-MM-DD. */
  dateOfBirth: string;
  weightKg: number;
  heightCm: number;
  /** An optional profile photo, separate from the starting photos. */
  avatar?: PickedPhoto | null;
  /** Photos still to upload; poses already uploaded (say on an earlier try) are left out. */
  photos: Partial<Record<PhotoPose, PickedPhoto>>;
};
