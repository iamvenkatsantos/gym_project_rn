import type { Exercise, ExerciseFilter } from '@/features/exercises/types';

export const emptyFilter: ExerciseFilter = {
  query: '',
  muscleGroup: null,
  equipment: null,
  difficulty: null,
};

export function filterExercises(exercises: Exercise[], filter: ExerciseFilter) {
  const query = filter.query.trim().toLowerCase();
  return exercises.filter(
    (e) =>
      (!query ||
        e.name.toLowerCase().includes(query) ||
        e.muscleGroups.some((m) => m.includes(query)) ||
        e.equipment.includes(query)) &&
      (!filter.muscleGroup || e.muscleGroups.includes(filter.muscleGroup)) &&
      (!filter.equipment || e.equipment === filter.equipment) &&
      (!filter.difficulty || e.difficulty === filter.difficulty),
  );
}

/** Distinct, sorted values for building filter chips from what's in the library. */
export function facets(exercises: Exercise[]) {
  const sorted = (values: string[]) => [...new Set(values)].sort();
  return {
    muscleGroups: sorted(exercises.flatMap((e) => e.muscleGroups)),
    equipment: sorted(exercises.map((e) => e.equipment)),
  };
}
