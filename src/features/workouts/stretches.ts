/**
 * Cool-down stretches, matched to the muscles a plan works. Kept in the app
 * (not the exercise library) because they're held, not counted in sets.
 */

export type Stretch = {
  id: string;
  name: string;
  /** Library muscle groups this stretch eases. */
  muscles: string[];
  holdSeconds: number;
  /** Stretch each side separately. */
  perSide: boolean;
  /** One short cue. */
  cue: string;
};

export const stretches: Stretch[] = [
  {
    id: 's-standing-quad',
    name: 'Standing quad stretch',
    muscles: ['legs'],
    holdSeconds: 30,
    perSide: true,
    cue: 'Rest one foot on a bench behind you, hips tucked.',
  },
  {
    id: 's-kneeling-hip-flexor',
    name: 'Kneeling hip flexor stretch',
    muscles: ['legs', 'glutes', 'core'],
    holdSeconds: 30,
    perSide: true,
    cue: 'Half-kneel, squeeze the back glute and shift hips forward.',
  },
  {
    id: 's-seated-hamstring',
    name: 'Seated hamstring stretch',
    muscles: ['hamstrings', 'legs'],
    holdSeconds: 30,
    perSide: true,
    cue: 'One leg straight, hinge at the hips towards your toes.',
  },
  {
    id: 's-figure-four',
    name: 'Figure-four glute stretch',
    muscles: ['glutes', 'hamstrings'],
    holdSeconds: 30,
    perSide: true,
    cue: 'On your back, ankle over knee, pull the lower leg in.',
  },
  {
    id: 's-wall-calf',
    name: 'Wall calf stretch',
    muscles: ['calves', 'cardio'],
    holdSeconds: 30,
    perSide: true,
    cue: 'Hands on a wall, back leg straight, heel down.',
  },
  {
    id: 's-butterfly',
    name: 'Butterfly stretch',
    muscles: ['legs', 'glutes'],
    holdSeconds: 30,
    perSide: false,
    cue: 'Soles together, sit tall, ease knees towards the floor.',
  },
  {
    id: 's-childs-pose',
    name: 'Child’s pose',
    muscles: ['back', 'shoulders', 'core'],
    holdSeconds: 45,
    perSide: false,
    cue: 'Sit back on your heels, arms long, breathe into your back.',
  },
  {
    id: 's-cat-cow',
    name: 'Cat-cow',
    muscles: ['back', 'core'],
    holdSeconds: 30,
    perSide: false,
    cue: 'On all fours, slowly round then arch your spine.',
  },
  {
    id: 's-lat-side-bend',
    name: 'Overhead side bend',
    muscles: ['back', 'core'],
    holdSeconds: 20,
    perSide: true,
    cue: 'Reach one arm overhead and lean away from it.',
  },
  {
    id: 's-overhead-reach',
    name: 'Overhead reach',
    muscles: ['core', 'chest'],
    holdSeconds: 20,
    perSide: false,
    cue: 'Lace your fingers, palms up, reach tall, shoulders down.',
  },
  {
    id: 's-elbows-back',
    name: 'Elbows-back chest stretch',
    muscles: ['chest', 'shoulders'],
    holdSeconds: 30,
    perSide: false,
    cue: 'Hands on your lower back, squeeze the elbows back.',
  },
  {
    id: 's-cross-body-shoulder',
    name: 'Cross-body shoulder stretch',
    muscles: ['shoulders', 'back'],
    holdSeconds: 20,
    perSide: true,
    cue: 'Pull one straight arm across your chest.',
  },
  {
    id: 's-overhead-triceps',
    name: 'Overhead triceps stretch',
    muscles: ['triceps', 'shoulders'],
    holdSeconds: 20,
    perSide: true,
    cue: 'Hand behind your head, pull the elbow gently.',
  },
  {
    id: 's-standing-biceps',
    name: 'Standing biceps stretch',
    muscles: ['biceps', 'chest'],
    holdSeconds: 20,
    perSide: false,
    cue: 'Clasp hands behind you, arms straight, lift gently.',
  },
  {
    id: 's-kneeling-forearm',
    name: 'Kneeling forearm stretch',
    muscles: ['forearms', 'biceps'],
    holdSeconds: 20,
    perSide: false,
    cue: 'Palms flat, fingers to your knees, lean back gently.',
  },
  {
    id: 's-neck-side',
    name: 'Neck side stretch',
    muscles: ['traps', 'shoulders'],
    holdSeconds: 20,
    perSide: true,
    cue: 'Tilt ear to shoulder, other shoulder relaxed down.',
  },
  {
    id: 's-standing-forward-fold',
    name: 'Standing forward fold',
    muscles: ['hamstrings', 'back', 'cardio'],
    holdSeconds: 30,
    perSide: false,
    cue: 'Soft knees, let your head and arms hang.',
  },
];

/** At most this many, so a cool-down stays around five minutes. */
export const MAX_STRETCHES = 6;

/**
 * Stretches for the muscles a plan works, the best matches first. Each muscle
 * gets one stretch before any gets a second.
 */
export function stretchesFor(muscles: readonly string[], limit = MAX_STRETCHES): Stretch[] {
  const worked = [...new Set(muscles)];
  if (worked.length === 0) return [];
  const score = (s: Stretch) => s.muscles.filter((m) => worked.includes(m)).length;
  const ranked = stretches.filter((s) => score(s) > 0).sort((a, b) => score(b) - score(a));
  const picked: Stretch[] = [];
  const covered = new Set<string>();
  // First pass: cover each worked muscle once.
  for (const s of ranked) {
    if (picked.length >= limit) break;
    if (s.muscles.some((m) => worked.includes(m) && !covered.has(m))) {
      picked.push(s);
      s.muscles.forEach((m) => covered.add(m));
    }
  }
  // Then fill up with the next best.
  for (const s of ranked) {
    if (picked.length >= limit) break;
    if (!picked.includes(s)) picked.push(s);
  }
  return picked;
}

/** "30s" or "30s each side". */
export function holdLabel(stretch: Stretch) {
  return `${stretch.holdSeconds}s${stretch.perSide ? ' each side' : ''}`;
}

export type StretchStep = { stretch: Stretch; side: 'Left side' | 'Right side' | null };

/** The cool-down as steps: a one-sided stretch is held once per side. */
export function stretchSteps(list: readonly Stretch[]): StretchStep[] {
  return list.flatMap((stretch): StretchStep[] =>
    stretch.perSide
      ? [
          { stretch, side: 'Left side' },
          { stretch, side: 'Right side' },
        ]
      : [{ stretch, side: null }],
  );
}
