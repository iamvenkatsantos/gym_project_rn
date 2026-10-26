import type {
  BodyMeasurement,
  MetricKey,
  MetricValues,
  PhotoPose,
  ProgressPhoto,
} from '@/features/body/types';

export type MetricInfo = {
  key: MetricKey;
  label: string;
  unit: string;
  /** Same bounds as the database checks. */
  min: number;
  max: number;
};

/** In the order the form and charts show them. Bounds match the body_measurements checks. */
export const METRICS: MetricInfo[] = [
  { key: 'weightKg', label: 'Weight', unit: 'kg', min: 20, max: 300 },
  { key: 'bodyFatPct', label: 'Body fat', unit: '%', min: 2, max: 70 },
  { key: 'waistCm', label: 'Waist', unit: 'cm', min: 30, max: 250 },
  { key: 'chestCm', label: 'Chest', unit: 'cm', min: 30, max: 250 },
  { key: 'hipsCm', label: 'Hips', unit: 'cm', min: 30, max: 250 },
  { key: 'armCm', label: 'Arm', unit: 'cm', min: 10, max: 100 },
  { key: 'thighCm', label: 'Thigh', unit: 'cm', min: 20, max: 150 },
  { key: 'heightCm', label: 'Height', unit: 'cm', min: 100, max: 250 },
];

export const METRIC_KEYS = METRICS.map((m) => m.key);

export function metricInfo(key: MetricKey) {
  return METRICS.find((m) => m.key === key)!;
}

export const POSES: { value: PhotoPose; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'side', label: 'Side' },
  { value: 'back', label: 'Back' },
];

export function emptyValues(): MetricValues {
  return {
    weightKg: null,
    heightCm: null,
    bodyFatPct: null,
    chestCm: null,
    waistCm: null,
    hipsCm: null,
    armCm: null,
    thighCm: null,
  };
}

/** Up to one decimal place, e.g. 72 or 72.5. */
const NUMBER_PATTERN = /^\d{1,3}([.,]\d)?$/;

/** The typed value as a number, or null when blank or not a number. */
export function parseMetric(text: string): number | null {
  const value = text.trim();
  if (!NUMBER_PATTERN.test(value)) return null;
  return Number(value.replace(',', '.'));
}

/** What's wrong with a typed value, or null when it's fine or left blank. */
export function validateMetric(text: string, key: MetricKey): string | null {
  if (!text.trim()) return null;
  const { label, unit, min, max } = metricInfo(key);
  const value = parseMetric(text);
  if (value === null) return `Enter ${label.toLowerCase()} as a number, like ${min + 10}.5.`;
  if (value < min || value > max)
    return `Enter ${label.toLowerCase()} from ${min} to ${max} ${unit}.`;
  return null;
}

export function hasAnyValue(values: MetricValues) {
  return METRIC_KEYS.some((key) => values[key] !== null);
}

export type Point = { date: string; value: number };

/** A metric's values over time, oldest first, skipping entries that left it blank. */
export function series(entries: BodyMeasurement[], key: MetricKey): Point[] {
  return entries
    .filter((e) => e[key] !== null)
    .map((e) => ({ date: e.measuredOn, value: e[key] as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function latest(entries: BodyMeasurement[], key: MetricKey): Point | null {
  return series(entries, key).at(-1) ?? null;
}

/** Change from the first to the latest value, or null with fewer than two. */
export function change(points: Point[]) {
  if (points.length < 2) return null;
  return round1(points[points.length - 1].value - points[0].value);
}

export function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function formatValue(value: number, key: MetricKey) {
  const { unit } = metricInfo(key);
  return unit === '%' ? `${round1(value)}%` : `${round1(value)} ${unit}`;
}

/** "+1.5 kg", "−2 cm" or "No change". */
export function formatChange(delta: number, key: MetricKey) {
  if (delta === 0) return 'No change';
  const sign = delta > 0 ? '+' : '−';
  return `${sign}${formatValue(Math.abs(delta), key)}`;
}

/** Body mass index from the latest weight and the latest height logged on any day. */
export function bmi(entries: BodyMeasurement[]): number | null {
  const weight = latest(entries, 'weightKg');
  const height = latest(entries, 'heightCm');
  if (!weight || !height) return null;
  const metres = height.value / 100;
  return round1(weight.value / (metres * metres));
}

/** WHO adult categories. */
export function bmiCategory(value: number) {
  if (value < 18.5) return 'Underweight range';
  if (value < 25) return 'Healthy range';
  if (value < 30) return 'Overweight range';
  return 'Obese range';
}

/** Metrics with at least one value, in display order. */
export function trackedMetrics(entries: BodyMeasurement[]): MetricKey[] {
  return METRIC_KEYS.filter((key) => key !== 'heightCm' && entries.some((e) => e[key] !== null));
}

/** The oldest and newest photo of a pose, for a before and after. Null with fewer than two. */
export function beforeAfter(photos: ProgressPhoto[], pose: PhotoPose) {
  const ofPose = photos
    .filter((p) => p.pose === pose)
    .sort((a, b) => a.takenOn.localeCompare(b.takenOn));
  if (ofPose.length < 2) return null;
  return { before: ofPose[0], after: ofPose[ofPose.length - 1] };
}
