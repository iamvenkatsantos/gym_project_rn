import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { QueryState } from '@/components/query-state';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing, TapTarget } from '@/constants/theme';
import { useExercises } from '@/features/exercises/hooks';
import { emptyFilter, filterExercises } from '@/features/exercises/rules';
import type { Exercise } from '@/features/exercises/types';
import { useTheme } from '@/hooks/use-theme';

const MAX_RESULTS = 8;

type ExercisePickerProps = {
  gymId: string;
  /** Exercises already in the plan, which aren't offered again. */
  excludeIds: string[];
  onPick: (exercise: Exercise) => void;
};

/** Search the exercise library and add exercises to a plan. */
export function ExercisePicker({ gymId, excludeIds, onPick }: ExercisePickerProps) {
  const theme = useTheme();
  const exercises = useExercises(gymId);
  const [query, setQuery] = useState('');

  return (
    <Card>
      <TextField
        label="Add exercise"
        placeholder="Search by name, muscle or equipment"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
      />
      <QueryState query={exercises}>
        {(list) => {
          const matches = filterExercises(list, { ...emptyFilter, query }).filter(
            (e) => !excludeIds.includes(e.id),
          );
          if (matches.length === 0) {
            return <ThemedText themeColor="textSecondary">No more exercises match.</ThemedText>;
          }
          return (
            <>
              {matches.slice(0, MAX_RESULTS).map((exercise) => (
                <Pressable
                  key={exercise.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${exercise.name}`}
                  onPress={() => onPick(exercise)}
                  style={({ pressed }) => [
                    styles.row,
                    { borderTopColor: theme.border },
                    pressed && styles.pressed,
                  ]}>
                  <View style={styles.text}>
                    <ThemedText type="smallBold">{exercise.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
                      {exercise.muscleGroups.join(', ')} ·{' '}
                      {exercise.equipment === 'none' ? 'no equipment' : exercise.equipment}
                    </ThemedText>
                  </View>
                  <Icon name="add-circle" size={26} color="primary" />
                </Pressable>
              ))}
              {matches.length > MAX_RESULTS ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {matches.length - MAX_RESULTS} more, search to narrow down.
                </ThemedText>
              ) : null}
            </>
          );
        }}
      </QueryState>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: TapTarget,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
  },
  text: {
    flex: 1,
  },
  meta: {
    textTransform: 'capitalize',
  },
  pressed: {
    opacity: 0.6,
  },
});
