import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import type { Workout } from '@/features/workouts/types';

export function WorkoutCard({ workout }: { workout: Workout }) {
  return (
    <Card>
      <ThemedText type="smallBold">{workout.title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {workout.level} · {workout.durationMinutes} min · {workout.exercises.length} exercises
      </ThemedText>
      <ThemedText type="small">{workout.description}</ThemedText>
      {workout.exercises.map((exercise) => (
        <ThemedText key={exercise.name} type="small" themeColor="textSecondary">
          {exercise.name}: {exercise.sets} × {exercise.reps}
        </ThemedText>
      ))}
    </Card>
  );
}
