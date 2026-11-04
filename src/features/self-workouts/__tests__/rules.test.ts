import { starterExercises } from '@/features/exercises/library';
import {
  buildSelfPlans,
  cleanSelfCheck,
  effortLabel,
  prefsProblem,
  selfCheckProblem,
  selfCheckSummary,
  selfWorkoutsOn,
  splitPlanNames,
  weekTemplates,
} from '@/features/self-workouts/rules';
import type { SelfPrefs } from '@/features/self-workouts/types';
import { planProblem } from '@/features/workouts/plan-draft';

const prefs = (over: Partial<SelfPrefs> = {}): SelfPrefs => ({
  goal: 'gain_muscle',
  level: 'intermediate',
  days: [1, 3, 5],
  split: 'split',
  ...over,
});

describe('self plan answers', () => {
  it('needs 3 to 6 days', () => {
    expect(prefsProblem({ days: [1, 2] })).toBe('Pick at least 3 days.');
    expect(prefsProblem({ days: [1, 2, 3] })).toBeNull();
    expect(prefsProblem({ days: [1, 2, 3, 4, 5, 6] })).toBeNull();
    expect(prefsProblem({ days: [1, 2, 3, 4, 5, 6, 7] })).toMatch(/at most 6/);
  });

  it('names the plans each split uses', () => {
    expect(splitPlanNames('intermediate', 'split')).toEqual(['Push day', 'Pull day', 'Leg day']);
    expect(splitPlanNames('intermediate', 'full_body')).toEqual(['Upper body', 'Lower body']);
  });
});

describe('building the week', () => {
  it('rotates the split across the days, in weekday order', () => {
    expect(weekTemplates(prefs({ days: [5, 1, 3] }))).toEqual([
      { day: 1, planId: 'sp-intermediate-push' },
      { day: 3, planId: 'sp-intermediate-pull' },
      { day: 5, planId: 'sp-intermediate-legs' },
    ]);
  });

  it('puts a repeated plan on all its days', () => {
    const plans = buildSelfPlans(prefs({ days: [1, 2, 3, 4, 5, 6] }), starterExercises);
    expect(plans.map((p) => [p.title, p.days])).toEqual([
      ['Push day', [1, 4]],
      ['Pull day', [2, 5]],
      ['Leg day', [3, 6]],
    ]);
  });

  it("gives a long week's last day to the goal", () => {
    const lose = weekTemplates(prefs({ goal: 'lose_weight', days: [1, 2, 4, 5] }));
    expect(lose.at(-1)).toEqual({ day: 5, planId: 'sp-beginner-fat-loss' });
    const fit = weekTemplates(prefs({ goal: 'stay_fit', days: [1, 2, 4, 5] }));
    expect(fit.at(-1)).toEqual({ day: 5, planId: 'sp-beginner-core-posture' });
    // Three days keep the full rotation.
    expect(weekTemplates(prefs({ goal: 'lose_weight' })).at(-1)?.planId).toBe(
      'sp-intermediate-legs',
    );
  });

  it('shortens rests to lose weight, never under 30 s', () => {
    const muscle = buildSelfPlans(prefs(), starterExercises);
    const lean = buildSelfPlans(prefs({ goal: 'lose_weight' }), starterExercises);
    expect(lean[0].exercises[0].restSeconds).toBeLessThan(muscle[0].exercises[0].restSeconds);
    for (const plan of lean) {
      for (const e of plan.exercises) expect(e.restSeconds).toBeGreaterThanOrEqual(30);
    }
  });

  it('makes plans that can be saved, for every level and split', () => {
    for (const level of ['beginner', 'intermediate', 'advanced'] as const) {
      for (const split of ['full_body', 'split'] as const) {
        const plans = buildSelfPlans(
          prefs({ level, split, days: [1, 2, 3, 4, 5, 6] }),
          starterExercises,
        );
        expect(plans.length).toBeGreaterThan(0);
        const days = plans.flatMap((p) => p.days).sort();
        expect(days).toEqual([1, 2, 3, 4, 5, 6]);
        for (const plan of plans) expect(planProblem(plan)).toBeNull();
      }
    }
  });

  it('drops plans the gym has no exercises for', () => {
    expect(buildSelfPlans(prefs(), [])).toEqual([]);
  });
});

describe('self-check', () => {
  const check = { effort: 7, pain: null, note: null };

  it('needs an effort from 1 to 10', () => {
    expect(selfCheckProblem({ ...check, effort: null })).toBe('Rate how hard it was.');
    expect(selfCheckProblem({ ...check, effort: 11 })).toBe('Pick an effort from 1 to 10.');
    expect(selfCheckProblem(check)).toBeNull();
  });

  it('asks where it hurt when pain is picked but blank', () => {
    expect(selfCheckProblem({ ...check, pain: '  ' })).toBe('Say where it hurt.');
    expect(selfCheckProblem({ ...check, pain: 'Knee' })).toBeNull();
  });

  it('trims blanks to null', () => {
    expect(cleanSelfCheck({ effort: 5, pain: ' Knee ', note: '  ' })).toEqual({
      effort: 5,
      pain: 'Knee',
      note: null,
    });
  });

  it('labels effort and sums it up', () => {
    expect([1, 5, 8, 10].map(effortLabel)).toEqual(['Easy', 'Moderate', 'Hard', 'All-out']);
    expect(selfCheckSummary({ effort: 8, pain: 'Knee', note: 'ok' })).toBe(
      'Effort 8/10 · Hard · Pain: Knee',
    );
  });

  it('is on when any of the member’s trainers turned it on', () => {
    const links = [
      { memberId: 'm', selfWorkouts: false },
      { memberId: 'm', selfWorkouts: true },
      { memberId: 'x', selfWorkouts: true },
    ];
    expect(selfWorkoutsOn(links, 'm')).toBe(true);
    expect(selfWorkoutsOn(links.slice(0, 1), 'm')).toBe(false);
  });
});
