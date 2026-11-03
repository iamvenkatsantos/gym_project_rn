import type { DemoFrame } from '@/features/exercises/demos';

/**
 * Start and end photos for each cool-down stretch, keyed by stretch id. Same source and
 * licence as the exercise demos: Free Exercise DB, public domain (Unlicense). Resized
 * copies live in assets/stretches/<name>/; `source` is the dataset's exercise id.
 */
export const stretchDemos: Record<string, { frames: [DemoFrame, DemoFrame]; source: string }> = {
  's-standing-quad': {
    frames: [
      require('@/assets/stretches/standing-quad/0.jpg'),
      require('@/assets/stretches/standing-quad/1.jpg'),
    ],
    source: 'Standing_Elevated_Quad_Stretch',
  },
  's-kneeling-hip-flexor': {
    frames: [
      require('@/assets/stretches/kneeling-hip-flexor/0.jpg'),
      require('@/assets/stretches/kneeling-hip-flexor/1.jpg'),
    ],
    source: 'Kneeling_Hip_Flexor',
  },
  's-seated-hamstring': {
    frames: [
      require('@/assets/stretches/seated-hamstring/0.jpg'),
      require('@/assets/stretches/seated-hamstring/1.jpg'),
    ],
    source: 'Seated_Floor_Hamstring_Stretch',
  },
  's-figure-four': {
    frames: [
      require('@/assets/stretches/figure-four/0.jpg'),
      require('@/assets/stretches/figure-four/1.jpg'),
    ],
    source: 'Ankle_On_The_Knee',
  },
  's-wall-calf': {
    frames: [
      require('@/assets/stretches/wall-calf/0.jpg'),
      require('@/assets/stretches/wall-calf/1.jpg'),
    ],
    source: 'Calf_Stretch_Hands_Against_Wall',
  },
  's-butterfly': {
    frames: [
      require('@/assets/stretches/butterfly/0.jpg'),
      require('@/assets/stretches/butterfly/1.jpg'),
    ],
    source: 'Groin_and_Back_Stretch',
  },
  's-childs-pose': {
    frames: [
      require('@/assets/stretches/childs-pose/0.jpg'),
      require('@/assets/stretches/childs-pose/1.jpg'),
    ],
    source: 'Childs_Pose',
  },
  's-cat-cow': {
    frames: [
      require('@/assets/stretches/cat-cow/0.jpg'),
      require('@/assets/stretches/cat-cow/1.jpg'),
    ],
    source: 'Cat_Stretch',
  },
  's-lat-side-bend': {
    frames: [
      require('@/assets/stretches/side-bend/0.jpg'),
      require('@/assets/stretches/side-bend/1.jpg'),
    ],
    source: 'Standing_Lateral_Stretch',
  },
  's-overhead-reach': {
    frames: [
      require('@/assets/stretches/overhead-reach/0.jpg'),
      require('@/assets/stretches/overhead-reach/1.jpg'),
    ],
    source: 'Overhead_Stretch',
  },
  's-elbows-back': {
    frames: [
      require('@/assets/stretches/elbows-back/0.jpg'),
      require('@/assets/stretches/elbows-back/1.jpg'),
    ],
    source: 'Elbows_Back',
  },
  's-cross-body-shoulder': {
    frames: [
      require('@/assets/stretches/cross-body-shoulder/0.jpg'),
      require('@/assets/stretches/cross-body-shoulder/1.jpg'),
    ],
    source: 'Shoulder_Stretch',
  },
  's-overhead-triceps': {
    frames: [
      require('@/assets/stretches/overhead-triceps/0.jpg'),
      require('@/assets/stretches/overhead-triceps/1.jpg'),
    ],
    source: 'Triceps_Stretch',
  },
  's-standing-biceps': {
    frames: [
      require('@/assets/stretches/standing-biceps/0.jpg'),
      require('@/assets/stretches/standing-biceps/1.jpg'),
    ],
    source: 'Standing_Biceps_Stretch',
  },
  's-kneeling-forearm': {
    frames: [
      require('@/assets/stretches/kneeling-forearm/0.jpg'),
      require('@/assets/stretches/kneeling-forearm/1.jpg'),
    ],
    source: 'Kneeling_Forearm_Stretch',
  },
  's-neck-side': {
    frames: [
      require('@/assets/stretches/neck-side/0.jpg'),
      require('@/assets/stretches/neck-side/1.jpg'),
    ],
    source: 'Side_Neck_Stretch',
  },
  's-standing-forward-fold': {
    frames: [
      require('@/assets/stretches/standing-forward-fold/0.jpg'),
      require('@/assets/stretches/standing-forward-fold/1.jpg'),
    ],
    source: 'Standing_Toe_Touches',
  },
};
