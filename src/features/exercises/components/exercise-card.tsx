import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Pill, type PillTone } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { ExerciseDemo } from '@/features/exercises/components/exercise-demo';
import type { Difficulty, Exercise } from '@/features/exercises/types';

export const difficultyTone: Record<Difficulty, PillTone> = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'danger',
};

export function ExerciseCard({ exercise }: { exercise: Exercise }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={exercise.name}
      onPress={() =>
        router.push({ pathname: '/exercise/[exerciseId]', params: { exerciseId: exercise.id } })
      }>
      {({ pressed }) => (
        <Card style={[styles.row, pressed && styles.pressed]}>
          <ExerciseDemo
            exerciseId={exercise.id}
            imageUrl={exercise.imageUrl}
            name={exercise.name}
            variant="thumb"
          />
          <View style={styles.body}>
            <ThemedText type="smallBold">{exercise.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.capitalize}>
              {exercise.muscleGroups.join(', ')} · {exercise.equipment}
            </ThemedText>
          </View>
          <Pill label={exercise.difficulty} tone={difficultyTone[exercise.difficulty]} />
          <Icon name="chevron-forward" size={18} />
        </Card>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  body: {
    flex: 1,
    gap: Spacing.half,
  },
  capitalize: {
    textTransform: 'capitalize',
  },
  pressed: {
    opacity: 0.75,
  },
});
