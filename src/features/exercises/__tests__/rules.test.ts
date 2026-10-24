import { starterExercises } from '@/features/exercises/library';
import { emptyFilter, facets, filterExercises } from '@/features/exercises/rules';

const names = (filter: Partial<typeof emptyFilter>) =>
  filterExercises(starterExercises, { ...emptyFilter, ...filter }).map((e) => e.name);

describe('filterExercises', () => {
  it('returns everything with no filter', () => {
    expect(names({})).toHaveLength(starterExercises.length);
  });

  it('searches names, muscle groups and equipment, ignoring case and spaces', () => {
    expect(names({ query: '  SQUAT ' })).toEqual(['Goblet squat', 'Back squat']);
    expect(names({ query: 'kettlebell' })).toEqual(['Kettlebell swing']);
    expect(names({ query: 'hamstrings' })).toEqual(['Romanian deadlift', 'Kettlebell swing']);
  });

  it('combines muscle group, equipment and difficulty filters', () => {
    expect(names({ muscleGroup: 'back', equipment: 'dumbbell' })).toEqual(['Dumbbell row']);
    expect(names({ muscleGroup: 'back', difficulty: 'advanced' })).toEqual(['Pull-up']);
  });
});

describe('facets', () => {
  it('lists each muscle group and piece of equipment once, sorted', () => {
    const { muscleGroups, equipment } = facets(starterExercises);
    expect(muscleGroups[0]).toBe('back');
    expect(new Set(muscleGroups).size).toBe(muscleGroups.length);
    expect(equipment).toContain('none');
  });
});
