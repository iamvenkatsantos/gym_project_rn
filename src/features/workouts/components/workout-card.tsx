import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Pill, type PillTone } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Workout, WorkoutLevel } from '@/features/workouts/types';
import { useTheme } from '@/hooks/use-theme';

const levelTone: Record<WorkoutLevel, PillTone> = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'danger',
};

export function WorkoutCard({ workout, action }: { workout: Workout; action?: ReactNode }) {
  const theme = useTheme();

  return (
    <Card>
      <Pill label={workout.level} tone={levelTone[workout.level]} />
      <ThemedText type="heading">{workout.title}</ThemedText>
      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Icon name="time-outline" size={16} />
          <ThemedText type="small" themeColor="textSecondary">
            {workout.durationMinutes} min
          </ThemedText>
        </View>
        <View style={styles.metaItem}>
          <Icon name="barbell-outline" size={16} />
          <ThemedText type="small" themeColor="textSecondary">
            {workout.exercises.length} exercises
          </ThemedText>
        </View>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {workout.description}
      </ThemedText>
      <View style={[styles.exercises, { borderTopColor: theme.border }]}>
        {workout.exercises.map((exercise) => (
          <View key={exercise.exerciseId} style={styles.exercise}>
            <ThemedText type="small">{exercise.name}</ThemedText>
            <ThemedText type="smallBold" themeColor="accent">
              {exercise.sets} × {exercise.reps}
              {exercise.targetWeightKg ? ` · ${exercise.targetWeightKg} kg` : ''}
            </ThemedText>
          </View>
        ))}
      </View>
      {action}
    </Card>
  );
}

const styles = StyleSheet.create({
  meta: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  exercises: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    marginTop: Spacing.one,
    gap: Spacing.one,
  },
  exercise: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
