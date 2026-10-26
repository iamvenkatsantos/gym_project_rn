import {
  beforeAfter,
  bmi,
  bmiCategory,
  change,
  emptyValues,
  formatChange,
  hasAnyValue,
  latest,
  parseMetric,
  series,
  trackedMetrics,
  validateMetric,
} from '@/features/body/rules';
import type { BodyMeasurement, ProgressPhoto } from '@/features/body/types';

function entry(measuredOn: string, values: Partial<BodyMeasurement>): BodyMeasurement {
  return { id: measuredOn, measuredOn, note: null, ...emptyValues(), ...values };
}

function photo(id: string, takenOn: string, pose: ProgressPhoto['pose']): ProgressPhoto {
  return { id, takenOn, pose, storagePath: id, url: null };
}

// Newest first, as the API returns them.
const entries = [
  entry('2026-10-20', { weightKg: 71, waistCm: 83 }),
  entry('2026-10-06', { bodyFatPct: 29 }),
  entry('2026-09-22', { weightKg: 73.5, heightCm: 165, waistCm: 86 }),
];

describe('parseMetric and validateMetric', () => {
  it('reads whole numbers and one decimal, with a dot or comma', () => {
    expect(parseMetric('72')).toBe(72);
    expect(parseMetric(' 72.5 ')).toBe(72.5);
    expect(parseMetric('72,5')).toBe(72.5);
    expect(parseMetric('72.55')).toBeNull();
    expect(parseMetric('abc')).toBeNull();
    expect(parseMetric('')).toBeNull();
  });

  it('allows blanks and explains values out of range', () => {
    expect(validateMetric('', 'weightKg')).toBeNull();
    expect(validateMetric('72.5', 'weightKg')).toBeNull();
    expect(validateMetric('500', 'weightKg')).toBe('Enter weight from 20 to 300 kg.');
    expect(validateMetric('7x', 'waistCm')).toMatch(/as a number/);
  });

  it('needs at least one value', () => {
    expect(hasAnyValue(emptyValues())).toBe(false);
    expect(hasAnyValue({ ...emptyValues(), armCm: 30 })).toBe(true);
  });
});

describe('series, latest and change', () => {
  it('lists a metric oldest first, skipping days without it', () => {
    expect(series(entries, 'weightKg')).toEqual([
      { date: '2026-09-22', value: 73.5 },
      { date: '2026-10-20', value: 71 },
    ]);
    expect(latest(entries, 'bodyFatPct')).toEqual({ date: '2026-10-06', value: 29 });
    expect(latest(entries, 'chestCm')).toBeNull();
  });

  it('measures change from the first value', () => {
    expect(change(series(entries, 'waistCm'))).toBe(-3);
    expect(change(series(entries, 'bodyFatPct'))).toBeNull();
    expect(formatChange(-2.5, 'weightKg')).toBe('−2.5 kg');
    expect(formatChange(1, 'bodyFatPct')).toBe('+1%');
    expect(formatChange(0, 'waistCm')).toBe('No change');
  });

  it('only charts metrics that were logged, and never height', () => {
    expect(trackedMetrics(entries)).toEqual(['weightKg', 'bodyFatPct', 'waistCm']);
  });
});

describe('bmi', () => {
  it('uses the latest weight with the last height logged on any day', () => {
    expect(bmi(entries)).toBe(26.1);
    expect(bmiCategory(26.1)).toBe('Overweight range');
    expect(bmiCategory(22)).toBe('Healthy range');
  });

  it('needs a height', () => {
    expect(bmi([entry('2026-10-20', { weightKg: 71 })])).toBeNull();
  });
});

describe('beforeAfter', () => {
  it('pairs the oldest and newest photo of a pose', () => {
    const photos = [
      photo('c', '2026-10-20', 'front'),
      photo('b', '2026-10-01', 'side'),
      photo('a', '2026-09-01', 'front'),
      photo('d', '2026-09-15', 'front'),
    ];
    expect(beforeAfter(photos, 'front')).toEqual({ before: photos[2], after: photos[0] });
    expect(beforeAfter(photos, 'side')).toBeNull();
  });
});
