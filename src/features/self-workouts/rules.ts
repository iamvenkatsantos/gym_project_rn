import type { Exercise } from '@/features/exercises/types';
import type { SelfCheck } from '@/features/progress/types';
import type { SelfGoal, SelfPlan, SelfPrefs, SelfSplit } from '@/features/self-workouts/types';
import { normaliseDays } from '@/features/workouts/schedule';
import { draftFromSmartPlan, smartPlans, type SmartPlan } from '@/features/workouts/smart-plans';
import type { WorkoutLevel } from '@/features/workouts/types';

/**
 * Self workouts: a member's trainer lets them build their own week. The member
 * answers four questions and gets plans made from the smart plans, one per
 * kind of day, each on the weekdays it falls on.
 */

export const SelfDays = { min: 3, max: 6 } as const;

export const goalOptions: { value: SelfGoal; label: string; hint: string }[] = [
  { value: 'gain_muscle', label: 'Gain muscle', hint: 'Build size and strength' },
  { value: 'lose_weight', label: 'Lose weight', hint: 'Burn fat, shorter rests' },
  { value: 'stay_fit', label: 'Stay fit', hint: 'Tone up, move well' },
];

/** Which smart plans make up the week, in order, by level and split. */
const rotations: Record<WorkoutLevel, Record<SelfSplit, string[]>> = {
  beginner: {
    full_body: ['sp-beginner-full-body-a', 'sp-beginner-full-body-b'],
    split: ['sp-beginner-full-body-a', 'sp-beginner-machine-circuit', 'sp-beginner-full-body-b'],
  },
  intermediate: {
    full_body: ['sp-intermediate-upper', 'sp-intermediate-lower'],
    split: ['sp-intermediate-push', 'sp-intermediate-pull', 'sp-intermediate-legs'],
  },
  advanced: {
    full_body: ['sp-advanced-heavy-lower', 'sp-advanced-heavy-upper', 'sp-advanced-power'],
    split: [
      'sp-advanced-heavy-lower',
      'sp-advanced-heavy-upper',
      'sp-advanced-chest-back',
      'sp-advanced-shoulders-arms',
    ],
  },
};

/** The extra day a goal adds at the end of a long week. */
const goalDay: Record<SelfGoal, string | null> = {
  gain_muscle: null,
  lose_weight: 'sp-beginner-fat-loss',
  stay_fit: 'sp-beginner-core-posture',
};

const planById = (id: string) => smartPlans.find((p) => p.id === id) as SmartPlan;

const levelLabel: Record<WorkoutLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

/** "Stay fit · Intermediate · 6 days". */
export function prefsSummary(prefs: SelfPrefs) {
  const goal = goalOptions.find((g) => g.value === prefs.goal)?.label;
  return [goal, levelLabel[prefs.level], `${prefs.days.length} days a week`]
    .filter(Boolean)
    .join(' · ');
}

/** The plan names a split uses at a level, shown under each choice. */
export function splitPlanNames(level: WorkoutLevel, split: SelfSplit) {
  return rotations[level][split].map((id) => planById(id).title);
}

/** Why the answers can't make a plan yet, or null. */
export function prefsProblem(prefs: Pick<SelfPrefs, 'days'>): string | null {
  const days = normaliseDays(prefs.days);
  if (days.length < SelfDays.min) return `Pick at least ${SelfDays.min} days.`;
  if (days.length > SelfDays.max) return `Pick at most ${SelfDays.max} days, rest helps you grow.`;
  return null;
}

/** Which smart plan each workout day gets. */
export function weekTemplates(prefs: SelfPrefs): { day: number; planId: string }[] {
  const days = normaliseDays(prefs.days);
  const rotation = rotations[prefs.level][prefs.split];
  const extra = goalDay[prefs.goal];
  return days.map((day, i) => {
    // A 4+ day week gives its last day to the goal: conditioning or core work.
    const last = i === days.length - 1;
    const planId =
      extra && last && days.length >= 4 && !rotation.includes(extra)
        ? extra
        : rotation[i % rotation.length];
    return { day, planId };
  });
}

/**
 * The member's week: one plan per smart plan used, on all the days it falls on.
 * Losing weight shortens rests. Exercises the gym doesn't have are left out,
 * and a plan with none left is dropped.
 */
export function buildSelfPlans(prefs: SelfPrefs, exercises: readonly Exercise[]): SelfPlan[] {
  const byPlan = new Map<string, number[]>();
  for (const { day, planId } of weekTemplates(prefs)) {
    byPlan.set(planId, [...(byPlan.get(planId) ?? []), day]);
  }
  return [...byPlan.entries()].flatMap(([planId, days]) => {
    const draft = draftFromSmartPlan(planById(planId), exercises);
    if (draft.exercises.length === 0) return [];
    const exercisesForGoal =
      prefs.goal === 'lose_weight'
        ? draft.exercises.map((e) => ({
            ...e,
            restSeconds: Math.max(30, Math.round((e.restSeconds * 0.6) / 15) * 15),
          }))
        : draft.exercises;
    return [{ ...draft, exercises: exercisesForGoal, days }];
  });
}

// Self-check -------------------------------------------------------------------------

export const NOTE_MAX = 300;
export const PAIN_MAX = 80;

/** Spots members pick from when something hurt. */
export const painSpots = [
  'Knee',
  'Lower back',
  'Shoulder',
  'Elbow',
  'Wrist',
  'Neck',
  'Hip',
  'Ankle',
];

/** "Easy" to "All-out" for an effort of 1 to 10. */
export function effortLabel(effort: number) {
  if (effort <= 3) return 'Easy';
  if (effort <= 6) return 'Moderate';
  if (effort <= 8) return 'Hard';
  return 'All-out';
}

/** Why the self-check can't be sent yet, or null. Effort is the one required answer. */
export function selfCheckProblem(check: SelfCheck): string | null {
  if (check.effort === null) return 'Rate how hard it was.';
  if (check.effort < 1 || check.effort > 10) return 'Pick an effort from 1 to 10.';
  if (check.pain !== null && !check.pain.trim()) return 'Say where it hurt.';
  if ((check.pain ?? '').length > PAIN_MAX) return `Keep it under ${PAIN_MAX} characters.`;
  if ((check.note ?? '').length > NOTE_MAX) return `Keep the note under ${NOTE_MAX} characters.`;
  return null;
}

/** Trims the answers for saving: blank pain or note becomes null. */
export function cleanSelfCheck(check: SelfCheck): SelfCheck {
  const pain = check.pain?.trim() || null;
  const note = check.note?.trim() || null;
  return { effort: check.effort, pain, note };
}

/** One short line, e.g. "Effort 8/10 · Hard · Pain: Knee". */
export function selfCheckSummary(check: SelfCheck) {
  return [
    check.effort !== null ? `Effort ${check.effort}/10 · ${effortLabel(check.effort)}` : null,
    check.pain ? `Pain: ${check.pain}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** True when any of the member's trainers switched self workouts on. */
export function selfWorkoutsOn(
  links: readonly { memberId: string; selfWorkouts?: boolean }[],
  memberId: string,
) {
  return links.some((l) => l.memberId === memberId && l.selfWorkouts);
}
