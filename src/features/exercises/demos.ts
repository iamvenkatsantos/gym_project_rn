import type { Exercise } from '@/features/exercises/types';

/**
 * Two-frame demonstrations (start and end position) for the shared library,
 * bundled with the app so they work offline and in Expo Go.
 *
 * Photos: Free Exercise DB (github.com/yuhonas/free-exercise-db), released
 * into the public domain under the Unlicense. Resized copies live in
 * assets/exercises/<library id>/. `source` is the dataset's exercise id.
 */
/** A bundled asset (`require`) or a remote image. */
export type DemoFrame = number | { uri: string };

type Demo = { frames: [DemoFrame, DemoFrame]; source: string };

const libraryDemos: Record<string, Demo> = {
  'e-goblet-squat': {
    frames: [
      require('@/assets/exercises/goblet-squat/0.jpg'),
      require('@/assets/exercises/goblet-squat/1.jpg'),
    ],
    source: 'Goblet_Squat',
  },
  'e-back-squat': {
    frames: [
      require('@/assets/exercises/back-squat/0.jpg'),
      require('@/assets/exercises/back-squat/1.jpg'),
    ],
    source: 'Barbell_Full_Squat',
  },
  'e-romanian-deadlift': {
    frames: [
      require('@/assets/exercises/romanian-deadlift/0.jpg'),
      require('@/assets/exercises/romanian-deadlift/1.jpg'),
    ],
    source: 'Romanian_Deadlift',
  },
  'e-walking-lunge': {
    frames: [
      require('@/assets/exercises/walking-lunge/0.jpg'),
      require('@/assets/exercises/walking-lunge/1.jpg'),
    ],
    source: 'Bodyweight_Walking_Lunge',
  },
  'e-push-up': {
    frames: [
      require('@/assets/exercises/push-up/0.jpg'),
      require('@/assets/exercises/push-up/1.jpg'),
    ],
    source: 'Pushups',
  },
  'e-bench-press': {
    frames: [
      require('@/assets/exercises/bench-press/0.jpg'),
      require('@/assets/exercises/bench-press/1.jpg'),
    ],
    source: 'Barbell_Bench_Press_-_Medium_Grip',
  },
  'e-dumbbell-row': {
    frames: [
      require('@/assets/exercises/dumbbell-row/0.jpg'),
      require('@/assets/exercises/dumbbell-row/1.jpg'),
    ],
    source: 'One-Arm_Dumbbell_Row',
  },
  'e-lat-pulldown': {
    frames: [
      require('@/assets/exercises/lat-pulldown/0.jpg'),
      require('@/assets/exercises/lat-pulldown/1.jpg'),
    ],
    source: 'Wide-Grip_Lat_Pulldown',
  },
  'e-overhead-press': {
    frames: [
      require('@/assets/exercises/overhead-press/0.jpg'),
      require('@/assets/exercises/overhead-press/1.jpg'),
    ],
    source: 'Dumbbell_Shoulder_Press',
  },
  'e-plank': {
    frames: [require('@/assets/exercises/plank/0.jpg'), require('@/assets/exercises/plank/1.jpg')],
    source: 'Plank',
  },
  'e-kettlebell-swing': {
    frames: [
      require('@/assets/exercises/kettlebell-swing/0.jpg'),
      require('@/assets/exercises/kettlebell-swing/1.jpg'),
    ],
    source: 'One-Arm_Kettlebell_Swings',
  },
  'e-pull-up': {
    frames: [
      require('@/assets/exercises/pull-up/0.jpg'),
      require('@/assets/exercises/pull-up/1.jpg'),
    ],
    source: 'Pullups',
  },
};

/**
 * Database ids of the seeded library (see scripts/exercise-seed-id.js), so
 * real-backend exercises and logged workouts find the same bundled demo.
 */
export const seedIds: Record<string, string> = {
  '29a2e281-90ff-5df1-a363-97fd8e47ab1e': 'e-goblet-squat',
  'f7e5fbcf-d7fc-5fcd-a649-5bb8936f6b83': 'e-back-squat',
  '1661c389-29f7-50fc-a1eb-8d38819fef97': 'e-romanian-deadlift',
  '7e8e14a8-10cc-58b5-a5f1-3925fa28f466': 'e-walking-lunge',
  '9c8933ce-19c7-5d51-a4ff-fb5e65b4b88a': 'e-push-up',
  '464b42c1-e485-592a-af81-9a0da75ec067': 'e-bench-press',
  '30ca8ab2-5aaf-5ca9-ad95-e583440d51ba': 'e-dumbbell-row',
  '3330470f-d454-5514-a8e6-2b73f9eebcf8': 'e-lat-pulldown',
  '24aa8e1e-6ce2-5ee3-aebc-71f18ddaa0c2': 'e-overhead-press',
  '95f22540-76b5-50d4-ace3-82740e370cf4': 'e-plank',
  '9773cedc-d9ef-5ac3-af10-795ca1da5679': 'e-kettlebell-swing',
  '1b747db3-7e0b-59b5-ace8-122479971836': 'e-pull-up',
};

export const DEMO_CREDIT = 'Photos: Free Exercise DB (public domain)';

export type ExerciseMedia = {
  frames: DemoFrame[];
  /** Shown under the demo when the media needs attribution. */
  credit: string | null;
};

/**
 * The demonstration for an exercise: the bundled frames for library
 * exercises (by library id or seeded database id), otherwise the exercise's
 * own image, e.g. one a gym added for its custom exercise.
 */
export function demoFor(
  exerciseId: string,
  imageUrl: Exercise['imageUrl'] = null,
): ExerciseMedia | null {
  const demo = libraryDemos[seedIds[exerciseId] ?? exerciseId];
  if (demo) return { frames: demo.frames, credit: DEMO_CREDIT };
  if (imageUrl) return { frames: [{ uri: imageUrl }], credit: null };
  return null;
}

export const libraryDemoIds = Object.keys(libraryDemos);
