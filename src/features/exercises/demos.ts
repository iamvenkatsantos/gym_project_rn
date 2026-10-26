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
  'e-dumbbell-bench-press': {
    frames: [
      require('@/assets/exercises/dumbbell-bench-press/0.jpg'),
      require('@/assets/exercises/dumbbell-bench-press/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-incline-dumbbell-press': {
    frames: [
      require('@/assets/exercises/incline-dumbbell-press/0.jpg'),
      require('@/assets/exercises/incline-dumbbell-press/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-incline-bench-press': {
    frames: [
      require('@/assets/exercises/incline-bench-press/0.jpg'),
      require('@/assets/exercises/incline-bench-press/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-decline-bench-press': {
    frames: [
      require('@/assets/exercises/decline-bench-press/0.jpg'),
      require('@/assets/exercises/decline-bench-press/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-dumbbell-fly': {
    frames: [
      require('@/assets/exercises/dumbbell-fly/0.jpg'),
      require('@/assets/exercises/dumbbell-fly/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-cable-crossover': {
    frames: [
      require('@/assets/exercises/cable-crossover/0.jpg'),
      require('@/assets/exercises/cable-crossover/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-pec-deck': {
    frames: [
      require('@/assets/exercises/pec-deck/0.jpg'),
      require('@/assets/exercises/pec-deck/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-machine-chest-press': {
    frames: [
      require('@/assets/exercises/machine-chest-press/0.jpg'),
      require('@/assets/exercises/machine-chest-press/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-chest-dip': {
    frames: [
      require('@/assets/exercises/chest-dip/0.jpg'),
      require('@/assets/exercises/chest-dip/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-dumbbell-pullover': {
    frames: [
      require('@/assets/exercises/dumbbell-pullover/0.jpg'),
      require('@/assets/exercises/dumbbell-pullover/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-deadlift': {
    frames: [
      require('@/assets/exercises/deadlift/0.jpg'),
      require('@/assets/exercises/deadlift/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-barbell-row': {
    frames: [
      require('@/assets/exercises/barbell-row/0.jpg'),
      require('@/assets/exercises/barbell-row/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-seated-cable-row': {
    frames: [
      require('@/assets/exercises/seated-cable-row/0.jpg'),
      require('@/assets/exercises/seated-cable-row/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-t-bar-row': {
    frames: [
      require('@/assets/exercises/t-bar-row/0.jpg'),
      require('@/assets/exercises/t-bar-row/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-chin-up': {
    frames: [
      require('@/assets/exercises/chin-up/0.jpg'),
      require('@/assets/exercises/chin-up/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-close-grip-pulldown': {
    frames: [
      require('@/assets/exercises/close-grip-pulldown/0.jpg'),
      require('@/assets/exercises/close-grip-pulldown/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-straight-arm-pulldown': {
    frames: [
      require('@/assets/exercises/straight-arm-pulldown/0.jpg'),
      require('@/assets/exercises/straight-arm-pulldown/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-inverted-row': {
    frames: [
      require('@/assets/exercises/inverted-row/0.jpg'),
      require('@/assets/exercises/inverted-row/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-machine-row': {
    frames: [
      require('@/assets/exercises/machine-row/0.jpg'),
      require('@/assets/exercises/machine-row/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-back-extension': {
    frames: [
      require('@/assets/exercises/back-extension/0.jpg'),
      require('@/assets/exercises/back-extension/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-barbell-shrug': {
    frames: [
      require('@/assets/exercises/barbell-shrug/0.jpg'),
      require('@/assets/exercises/barbell-shrug/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-dumbbell-shrug': {
    frames: [
      require('@/assets/exercises/dumbbell-shrug/0.jpg'),
      require('@/assets/exercises/dumbbell-shrug/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-lateral-raise': {
    frames: [
      require('@/assets/exercises/lateral-raise/0.jpg'),
      require('@/assets/exercises/lateral-raise/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-front-raise': {
    frames: [
      require('@/assets/exercises/front-raise/0.jpg'),
      require('@/assets/exercises/front-raise/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-rear-delt-fly': {
    frames: [
      require('@/assets/exercises/rear-delt-fly/0.jpg'),
      require('@/assets/exercises/rear-delt-fly/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-arnold-press': {
    frames: [
      require('@/assets/exercises/arnold-press/0.jpg'),
      require('@/assets/exercises/arnold-press/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-military-press': {
    frames: [
      require('@/assets/exercises/military-press/0.jpg'),
      require('@/assets/exercises/military-press/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-machine-shoulder-press': {
    frames: [
      require('@/assets/exercises/machine-shoulder-press/0.jpg'),
      require('@/assets/exercises/machine-shoulder-press/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-face-pull': {
    frames: [
      require('@/assets/exercises/face-pull/0.jpg'),
      require('@/assets/exercises/face-pull/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-upright-row': {
    frames: [
      require('@/assets/exercises/upright-row/0.jpg'),
      require('@/assets/exercises/upright-row/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-reverse-pec-deck': {
    frames: [
      require('@/assets/exercises/reverse-pec-deck/0.jpg'),
      require('@/assets/exercises/reverse-pec-deck/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-barbell-curl': {
    frames: [
      require('@/assets/exercises/barbell-curl/0.jpg'),
      require('@/assets/exercises/barbell-curl/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-dumbbell-curl': {
    frames: [
      require('@/assets/exercises/dumbbell-curl/0.jpg'),
      require('@/assets/exercises/dumbbell-curl/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-hammer-curl': {
    frames: [
      require('@/assets/exercises/hammer-curl/0.jpg'),
      require('@/assets/exercises/hammer-curl/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-preacher-curl': {
    frames: [
      require('@/assets/exercises/preacher-curl/0.jpg'),
      require('@/assets/exercises/preacher-curl/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-ez-bar-curl': {
    frames: [
      require('@/assets/exercises/ez-bar-curl/0.jpg'),
      require('@/assets/exercises/ez-bar-curl/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-incline-dumbbell-curl': {
    frames: [
      require('@/assets/exercises/incline-dumbbell-curl/0.jpg'),
      require('@/assets/exercises/incline-dumbbell-curl/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-concentration-curl': {
    frames: [
      require('@/assets/exercises/concentration-curl/0.jpg'),
      require('@/assets/exercises/concentration-curl/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-reverse-curl': {
    frames: [
      require('@/assets/exercises/reverse-curl/0.jpg'),
      require('@/assets/exercises/reverse-curl/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-triceps-pushdown': {
    frames: [
      require('@/assets/exercises/triceps-pushdown/0.jpg'),
      require('@/assets/exercises/triceps-pushdown/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-overhead-cable-extension': {
    frames: [
      require('@/assets/exercises/overhead-cable-extension/0.jpg'),
      require('@/assets/exercises/overhead-cable-extension/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-skull-crusher': {
    frames: [
      require('@/assets/exercises/skull-crusher/0.jpg'),
      require('@/assets/exercises/skull-crusher/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-close-grip-bench-press': {
    frames: [
      require('@/assets/exercises/close-grip-bench-press/0.jpg'),
      require('@/assets/exercises/close-grip-bench-press/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-bench-dip': {
    frames: [
      require('@/assets/exercises/bench-dip/0.jpg'),
      require('@/assets/exercises/bench-dip/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-triceps-dip': {
    frames: [
      require('@/assets/exercises/triceps-dip/0.jpg'),
      require('@/assets/exercises/triceps-dip/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-dumbbell-kickback': {
    frames: [
      require('@/assets/exercises/dumbbell-kickback/0.jpg'),
      require('@/assets/exercises/dumbbell-kickback/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-overhead-dumbbell-extension': {
    frames: [
      require('@/assets/exercises/overhead-dumbbell-extension/0.jpg'),
      require('@/assets/exercises/overhead-dumbbell-extension/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-front-squat': {
    frames: [
      require('@/assets/exercises/front-squat/0.jpg'),
      require('@/assets/exercises/front-squat/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-leg-press': {
    frames: [
      require('@/assets/exercises/leg-press/0.jpg'),
      require('@/assets/exercises/leg-press/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-leg-extension': {
    frames: [
      require('@/assets/exercises/leg-extension/0.jpg'),
      require('@/assets/exercises/leg-extension/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-lying-leg-curl': {
    frames: [
      require('@/assets/exercises/lying-leg-curl/0.jpg'),
      require('@/assets/exercises/lying-leg-curl/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-seated-leg-curl': {
    frames: [
      require('@/assets/exercises/seated-leg-curl/0.jpg'),
      require('@/assets/exercises/seated-leg-curl/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-hack-squat': {
    frames: [
      require('@/assets/exercises/hack-squat/0.jpg'),
      require('@/assets/exercises/hack-squat/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-bodyweight-squat': {
    frames: [
      require('@/assets/exercises/bodyweight-squat/0.jpg'),
      require('@/assets/exercises/bodyweight-squat/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-dumbbell-lunge': {
    frames: [
      require('@/assets/exercises/dumbbell-lunge/0.jpg'),
      require('@/assets/exercises/dumbbell-lunge/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-split-squat': {
    frames: [
      require('@/assets/exercises/split-squat/0.jpg'),
      require('@/assets/exercises/split-squat/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-step-up': {
    frames: [
      require('@/assets/exercises/step-up/0.jpg'),
      require('@/assets/exercises/step-up/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-sumo-deadlift': {
    frames: [
      require('@/assets/exercises/sumo-deadlift/0.jpg'),
      require('@/assets/exercises/sumo-deadlift/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-stiff-leg-deadlift': {
    frames: [
      require('@/assets/exercises/stiff-leg-deadlift/0.jpg'),
      require('@/assets/exercises/stiff-leg-deadlift/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-good-morning': {
    frames: [
      require('@/assets/exercises/good-morning/0.jpg'),
      require('@/assets/exercises/good-morning/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-smith-machine-squat': {
    frames: [
      require('@/assets/exercises/smith-machine-squat/0.jpg'),
      require('@/assets/exercises/smith-machine-squat/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-standing-calf-raise': {
    frames: [
      require('@/assets/exercises/standing-calf-raise/0.jpg'),
      require('@/assets/exercises/standing-calf-raise/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-seated-calf-raise': {
    frames: [
      require('@/assets/exercises/seated-calf-raise/0.jpg'),
      require('@/assets/exercises/seated-calf-raise/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-hip-thrust': {
    frames: [
      require('@/assets/exercises/hip-thrust/0.jpg'),
      require('@/assets/exercises/hip-thrust/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-glute-bridge': {
    frames: [
      require('@/assets/exercises/glute-bridge/0.jpg'),
      require('@/assets/exercises/glute-bridge/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-glute-kickback': {
    frames: [
      require('@/assets/exercises/glute-kickback/0.jpg'),
      require('@/assets/exercises/glute-kickback/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-hip-adduction': {
    frames: [
      require('@/assets/exercises/hip-adduction/0.jpg'),
      require('@/assets/exercises/hip-adduction/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-hip-abduction': {
    frames: [
      require('@/assets/exercises/hip-abduction/0.jpg'),
      require('@/assets/exercises/hip-abduction/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-crunch': {
    frames: [
      require('@/assets/exercises/crunch/0.jpg'),
      require('@/assets/exercises/crunch/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-hanging-leg-raise': {
    frames: [
      require('@/assets/exercises/hanging-leg-raise/0.jpg'),
      require('@/assets/exercises/hanging-leg-raise/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-russian-twist': {
    frames: [
      require('@/assets/exercises/russian-twist/0.jpg'),
      require('@/assets/exercises/russian-twist/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-ab-wheel-rollout': {
    frames: [
      require('@/assets/exercises/ab-wheel-rollout/0.jpg'),
      require('@/assets/exercises/ab-wheel-rollout/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-bicycle-crunch': {
    frames: [
      require('@/assets/exercises/bicycle-crunch/0.jpg'),
      require('@/assets/exercises/bicycle-crunch/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-side-plank': {
    frames: [
      require('@/assets/exercises/side-plank/0.jpg'),
      require('@/assets/exercises/side-plank/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-dead-bug': {
    frames: [
      require('@/assets/exercises/dead-bug/0.jpg'),
      require('@/assets/exercises/dead-bug/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-lying-leg-raise': {
    frames: [
      require('@/assets/exercises/lying-leg-raise/0.jpg'),
      require('@/assets/exercises/lying-leg-raise/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-cable-crunch': {
    frames: [
      require('@/assets/exercises/cable-crunch/0.jpg'),
      require('@/assets/exercises/cable-crunch/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-mountain-climber': {
    frames: [
      require('@/assets/exercises/mountain-climber/0.jpg'),
      require('@/assets/exercises/mountain-climber/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-reverse-crunch': {
    frames: [
      require('@/assets/exercises/reverse-crunch/0.jpg'),
      require('@/assets/exercises/reverse-crunch/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-pallof-press': {
    frames: [
      require('@/assets/exercises/pallof-press/0.jpg'),
      require('@/assets/exercises/pallof-press/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-treadmill-walk': {
    frames: [
      require('@/assets/exercises/treadmill-walk/0.jpg'),
      require('@/assets/exercises/treadmill-walk/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-exercise-bike': {
    frames: [
      require('@/assets/exercises/exercise-bike/0.jpg'),
      require('@/assets/exercises/exercise-bike/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-rowing-machine': {
    frames: [
      require('@/assets/exercises/rowing-machine/0.jpg'),
      require('@/assets/exercises/rowing-machine/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-elliptical': {
    frames: [
      require('@/assets/exercises/elliptical/0.jpg'),
      require('@/assets/exercises/elliptical/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-stair-climber': {
    frames: [
      require('@/assets/exercises/stair-climber/0.jpg'),
      require('@/assets/exercises/stair-climber/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-jump-rope': {
    frames: [
      require('@/assets/exercises/jump-rope/0.jpg'),
      require('@/assets/exercises/jump-rope/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-box-jump': {
    frames: [
      require('@/assets/exercises/box-jump/0.jpg'),
      require('@/assets/exercises/box-jump/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-battle-ropes': {
    frames: [
      require('@/assets/exercises/battle-ropes/0.jpg'),
      require('@/assets/exercises/battle-ropes/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-kettlebell-thruster': {
    frames: [
      require('@/assets/exercises/kettlebell-thruster/0.jpg'),
      require('@/assets/exercises/kettlebell-thruster/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-turkish-get-up': {
    frames: [
      require('@/assets/exercises/turkish-get-up/0.jpg'),
      require('@/assets/exercises/turkish-get-up/1.jpg'),
    ],
    source: 'Power_Clean',
  },
  'e-power-clean': {
    frames: [
      require('@/assets/exercises/power-clean/0.jpg'),
      require('@/assets/exercises/power-clean/1.jpg'),
    ],
    source: 'Power_Clean',
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
  '747699d3-f3dd-51f8-ad84-8afb818f3944': 'e-dumbbell-bench-press',
  '49280e48-e1f2-584a-a0b1-b268e6788639': 'e-incline-dumbbell-press',
  '5e9ec6d4-eefc-5f6e-a480-b22dbf2ca2c7': 'e-incline-bench-press',
  'e0baf6c5-a221-51ac-a841-cddf100af32c': 'e-decline-bench-press',
  '3b03e42e-ea22-531d-a7fa-b437a754a54e': 'e-dumbbell-fly',
  'adc64545-afd6-5731-aeb3-c6449f8ded16': 'e-cable-crossover',
  '9993f4bf-e749-55fd-a249-a92c62c46463': 'e-pec-deck',
  '6eafc8b4-90ba-5678-a7c4-3e891bc3edcb': 'e-machine-chest-press',
  '4d579687-7167-5995-a4ee-423e07253993': 'e-chest-dip',
  '31d08278-82f7-506a-a309-324e3a1c537b': 'e-dumbbell-pullover',
  'a34c433c-1b8b-5039-a258-f8850da3afd3': 'e-deadlift',
  '10e874d5-398b-5f08-a82c-d4bb6eac347f': 'e-barbell-row',
  '6c215feb-6f82-51cb-a9c3-9608f9c7dfa7': 'e-seated-cable-row',
  '4d81ca68-b9dc-59ec-ad99-2307b777f30a': 'e-t-bar-row',
  'a698c578-bfe4-5ac3-a8a6-bbb0eb51bf0f': 'e-chin-up',
  'a78193ca-365a-59a5-a2c4-6305fd85c51d': 'e-close-grip-pulldown',
  '3142bc78-94f7-5099-a367-05806941fa06': 'e-straight-arm-pulldown',
  '71683aac-3f96-52f3-ae02-f951040e11d3': 'e-inverted-row',
  '8f49d188-fe7f-53bb-ac10-09c3ac7e0268': 'e-machine-row',
  '6f1245bb-cb47-50c2-aee3-a8ca20c8147e': 'e-back-extension',
  '91a9a531-c581-5841-abf0-044de9a3ef9c': 'e-barbell-shrug',
  '05457e6a-90b3-5623-a683-3ad8323fa704': 'e-dumbbell-shrug',
  '24174766-a9e7-5ec2-a75e-d3eccdc527aa': 'e-lateral-raise',
  '8aef0b06-70db-50d5-a6c2-70c9c00d6d5f': 'e-front-raise',
  '97e3a069-e585-51a9-ae69-92d4c48a5593': 'e-rear-delt-fly',
  '32d4cb27-57f7-58ae-a2fe-27e837ce1221': 'e-arnold-press',
  'e4a0535d-a112-5c7e-a8fb-adebb801fc71': 'e-military-press',
  '9161b261-e153-5689-a62c-32cf3787c440': 'e-machine-shoulder-press',
  'cf1dcd4a-5d51-5848-a111-984bdb0daed1': 'e-face-pull',
  '1cb0a2c3-ff65-5d41-a7a1-0ab33030563d': 'e-upright-row',
  'd4ee917f-fe90-58a8-af14-d0719cd744c1': 'e-reverse-pec-deck',
  '1ed93482-f7b0-54c6-a4a7-3144e5c094a6': 'e-barbell-curl',
  'dbd4dd14-779b-5e95-a581-2af26cde3e4d': 'e-dumbbell-curl',
  'b1a16f62-fbe5-5c71-a3eb-e99e73887fac': 'e-hammer-curl',
  '0d884446-2dea-5dee-a599-2c4c40ba078c': 'e-preacher-curl',
  '9ee53d64-63fb-5f76-a4af-a4990efd487f': 'e-ez-bar-curl',
  '9911f777-75d3-59f1-a868-572f7526ee21': 'e-incline-dumbbell-curl',
  'a6357709-6ae6-5e08-a6d2-65e28a76f7c0': 'e-concentration-curl',
  'b0ee1b1a-65e4-569c-a7d7-33972f44e1a2': 'e-reverse-curl',
  '98cfd8f8-64db-5874-ae67-9f8bf6e73534': 'e-triceps-pushdown',
  '0c1d6e3e-e76d-5533-aa77-fd9e7ce4f2ad': 'e-overhead-cable-extension',
  '003817a5-561e-554c-adc6-c4316b871ad6': 'e-skull-crusher',
  'a7464533-5d33-5d27-a34b-b72b5d61606e': 'e-close-grip-bench-press',
  'bb728fce-3700-5d72-a59b-ab94d3be6b7f': 'e-bench-dip',
  'e662031e-d1ac-52ad-a402-93e05bfa7bb3': 'e-triceps-dip',
  '0db53908-2005-5942-a469-a58cc3625676': 'e-dumbbell-kickback',
  '8b50443b-5004-57ac-aa32-b7ba4b24ce2a': 'e-overhead-dumbbell-extension',
  '9a0ece15-f864-575c-a989-bb4e8d0d19a2': 'e-front-squat',
  'b70b143f-6f44-5b28-a128-e5d85669ffc9': 'e-leg-press',
  '296a1349-ccc0-572c-a4ed-1ebbf29cde4e': 'e-leg-extension',
  'f677969a-cb8a-525d-a2d4-2578f50fc3b3': 'e-lying-leg-curl',
  '707c34d1-930e-5c1b-acad-85a4bb12bcb5': 'e-seated-leg-curl',
  '67ce9997-ba6d-5cae-a828-875a5e1d0620': 'e-hack-squat',
  'a0cd4fce-544a-5457-a995-9cfdb1b8d0be': 'e-bodyweight-squat',
  '50d05794-2878-5faa-a368-c8b9013bb650': 'e-dumbbell-lunge',
  '1cfddcb1-e3a9-5bfd-aaba-cc0fca10b7fe': 'e-split-squat',
  '2c71625b-4275-516d-aaa7-03f58032de69': 'e-step-up',
  'de04fd09-6d11-5c37-aa7a-e86ee0336e43': 'e-sumo-deadlift',
  'a4c342f4-21a5-57d2-af59-38e978b98223': 'e-stiff-leg-deadlift',
  '22fb7e68-5527-57a1-ad0a-e906987ab38b': 'e-good-morning',
  '297faf54-8327-593d-a004-f0f3d515e8f2': 'e-smith-machine-squat',
  'ebd044a1-984b-5bcf-a065-a402d54dc6d6': 'e-standing-calf-raise',
  '755a7aaa-7e25-50aa-a7af-0d7dd92aa643': 'e-seated-calf-raise',
  'c0b4ad0d-ae39-566a-a376-663652805988': 'e-hip-thrust',
  '0e77e2cc-5af9-578c-a737-604fbb303d63': 'e-glute-bridge',
  '0bbc6d8d-480f-5ea2-a957-fc9b903cb80b': 'e-glute-kickback',
  'e4db09ad-7023-5db7-aaf0-0589478dc41f': 'e-hip-adduction',
  'ff7de32d-5c17-5598-ac76-131a59d869d6': 'e-hip-abduction',
  'fd589773-e06b-5686-a658-31a9ffe1e4de': 'e-crunch',
  '58fd6a08-3df3-5080-aa5d-c88b7ae47ee8': 'e-hanging-leg-raise',
  '25b045e8-1a94-5be8-ae8f-c03ff032db09': 'e-russian-twist',
  'dd699eb7-3280-5983-a7a6-f9ad92091369': 'e-ab-wheel-rollout',
  '7c15b3e7-6a59-59a3-a2c7-66ed1e4a8bc6': 'e-bicycle-crunch',
  '40aecce0-ec51-5216-a7af-bf0ec9f59263': 'e-side-plank',
  '2381e8ad-a0f7-5349-a3a1-28dd74cc04fc': 'e-dead-bug',
  'eafa8192-f7ec-53f2-a319-2d6319be20d5': 'e-lying-leg-raise',
  '5b57c690-2ef9-5c39-ad55-45c1db93729a': 'e-cable-crunch',
  '92ace64a-d576-5313-a490-174b674f3450': 'e-mountain-climber',
  'bc0b6e0a-ed07-5484-a011-12a6401f70fb': 'e-reverse-crunch',
  'bb9687d7-8e97-5a75-ae14-104e9740fdcd': 'e-pallof-press',
  '54447166-ee08-5595-a20f-8a696071c436': 'e-treadmill-walk',
  '2babc59a-dac1-5cef-a066-3d335e0fb5ef': 'e-exercise-bike',
  'dae592d8-4d42-5ccf-a777-ce5cde13eca9': 'e-rowing-machine',
  'e374a479-305a-53f7-aff1-be4baf589e1e': 'e-elliptical',
  '964537c9-32b5-59fc-a901-df5cd0da5b9e': 'e-stair-climber',
  'e28ebb6c-fc36-5ab5-afdf-511f77a4f2ae': 'e-jump-rope',
  'cfa9ccfe-d7a8-5296-a504-5bd3fafa151c': 'e-box-jump',
  '0c098e65-3502-5510-ae9f-f2de3c236715': 'e-battle-ropes',
  'daa942a2-d1b0-5dab-a61e-35b9ff5ee9aa': 'e-kettlebell-thruster',
  '306d552b-9a72-55d9-aabd-b36120357ddb': 'e-turkish-get-up',
  '3333adee-843f-5f31-a64d-6bf33a64a1b9': 'e-power-clean',
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
