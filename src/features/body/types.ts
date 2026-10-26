/** Numbers a member can log. Each is optional; an entry needs at least one. */
export type MetricKey =
  'weightKg' | 'heightCm' | 'bodyFatPct' | 'chestCm' | 'waistCm' | 'hipsCm' | 'armCm' | 'thighCm';

export type MetricValues = Record<MetricKey, number | null>;

/** One day's measurements. Logging again on the same day updates the entry. */
export type BodyMeasurement = MetricValues & {
  id: string;
  /** Local date, YYYY-MM-DD. */
  measuredOn: string;
  note: string | null;
};

export type MeasurementInput = MetricValues & {
  measuredOn: string;
  note: string | null;
};

export type PhotoPose = 'front' | 'side' | 'back';

export type ProgressPhoto = {
  id: string;
  pose: PhotoPose;
  takenOn: string;
  storagePath: string;
  /** Short-lived signed link; null when the file couldn't be signed. */
  url: string | null;
};

/** A picked image, ready to upload. */
export type PhotoUpload = {
  uri: string;
  mimeType: string;
  pose: PhotoPose;
  takenOn: string;
};
