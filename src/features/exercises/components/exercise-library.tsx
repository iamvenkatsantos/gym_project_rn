import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Chip } from '@/components/chip';
import { Icon } from '@/components/icon';
import { QueryState } from '@/components/query-state';
import { ThemedText } from '@/components/themed-text';
import { MaxFontScale, Radius, Spacing, TapTarget } from '@/constants/theme';
import { ExerciseCard } from '@/features/exercises/components/exercise-card';
import { useExercises } from '@/features/exercises/hooks';
import { emptyFilter, facets, filterExercises } from '@/features/exercises/rules';
import type { Difficulty, ExerciseFilter } from '@/features/exercises/types';
import { useTheme } from '@/hooks/use-theme';

const difficulties: Difficulty[] = ['beginner', 'intermediate', 'advanced'];

/** Searchable, filterable exercise library, shared by members and trainers. */
export function ExerciseLibrary({ gymId }: { gymId: string }) {
  const theme = useTheme();
  const exercises = useExercises(gymId);
  const [filter, setFilter] = useState<ExerciseFilter>(emptyFilter);
  const options = useMemo(() => facets(exercises.data ?? []), [exercises.data]);
  const toggle = <K extends 'muscleGroup' | 'equipment' | 'difficulty'>(
    key: K,
    value: ExerciseFilter[K],
  ) => setFilter((f) => ({ ...f, [key]: f[key] === value ? null : value }));

  return (
    <>
      <View
        style={[
          styles.search,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}>
        <Icon name="search" size={18} />
        <TextInput
          maxFontSizeMultiplier={MaxFontScale}
          accessibilityLabel="Search exercises"
          placeholder="Search exercises, muscles, equipment"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }]}
          value={filter.query}
          onChangeText={(query) => setFilter((f) => ({ ...f, query }))}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}>
        {options.muscleGroups.map((m) => (
          <Chip
            key={m}
            label={m}
            selected={filter.muscleGroup === m}
            onPress={() => toggle('muscleGroup', m)}
          />
        ))}
      </ScrollView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}>
        {difficulties.map((d) => (
          <Chip
            key={d}
            label={d}
            selected={filter.difficulty === d}
            onPress={() => toggle('difficulty', d)}
          />
        ))}
        {options.equipment.map((e) => (
          <Chip
            key={e}
            label={e === 'none' ? 'No equipment' : e}
            selected={filter.equipment === e}
            onPress={() => toggle('equipment', e)}
          />
        ))}
      </ScrollView>

      <QueryState query={exercises}>
        {(list) => {
          const results = filterExercises(list, filter);
          return results.length === 0 ? (
            <ThemedText themeColor="textSecondary">No exercises match.</ThemedText>
          ) : (
            results.map((exercise) => <ExerciseCard key={exercise.id} exercise={exercise} />)
          );
        }}
      </QueryState>
    </>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: TapTarget,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 16,
    minHeight: TapTarget,
  },
  chips: {
    gap: Spacing.two,
  },
});
