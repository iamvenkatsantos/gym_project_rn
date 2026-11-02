import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Icon } from '@/components/icon';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing, TapTarget } from '@/constants/theme';
import { useActiveGym } from '@/features/auth/use-profile';
import { useExercises } from '@/features/exercises/hooks';
import { emptyFilter, facets, filterExercises } from '@/features/exercises/rules';
import { useExercisePicks } from '@/features/workouts/exercise-picks';
import { useTheme } from '@/hooks/use-theme';

/**
 * Search pinned at the top and results below it, so the keyboard never covers
 * what's being searched. Taps add straight away; the screen stays open.
 */
export default function AddExercisesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const gym = useActiveGym();
  const exercises = useExercises(gym.gymId);
  const excludeIds = useExercisePicks((s) => s.excludeIds);
  const pick = useExercisePicks((s) => s.pick);
  const close = useExercisePicks((s) => s.close);
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [added, setAdded] = useState<string[]>([]);

  // Forget the plan's callback once this screen goes away.
  useEffect(() => close, [close]);

  const list = useMemo(() => exercises.data ?? [], [exercises.data]);
  const muscles = useMemo(() => facets(list).muscleGroups, [list]);
  const matches = filterExercises(list, { ...emptyFilter, query, muscleGroup: muscle }).filter(
    (e) => added.includes(e.id) || !excludeIds.includes(e.id),
  );

  return (
    <ThemedView style={styles.root}>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <View style={styles.top}>
          <TextField
            label="Search"
            placeholder="Name, muscle or equipment"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.chips}>
            <Chip label="All" selected={muscle === null} onPress={() => setMuscle(null)} />
            {muscles.map((m) => (
              <Chip
                key={m}
                label={m}
                selected={muscle === m}
                onPress={() => setMuscle(muscle === m ? null : m)}
              />
            ))}
          </ScrollView>
        </View>
        <FlatList
          data={matches}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary">
              {exercises.isPending ? 'Loading…' : 'No exercises match.'}
            </ThemedText>
          }
          renderItem={({ item }) => {
            const isAdded = added.includes(item.id);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isAdded ? `${item.name}, added` : `Add ${item.name}`}
                accessibilityState={{ disabled: isAdded }}
                disabled={isAdded}
                onPress={() => {
                  pick(item);
                  setAdded((a) => [...a, item.id]);
                }}
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: theme.border },
                  pressed && styles.pressed,
                ]}>
                <View style={styles.text}>
                  <ThemedText type="smallBold">{item.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
                    {item.muscleGroups.join(', ')} ·{' '}
                    {item.equipment === 'none' ? 'no equipment' : item.equipment}
                  </ThemedText>
                </View>
                <Icon
                  name={isAdded ? 'checkmark-circle' : 'add-circle'}
                  size={26}
                  color={isAdded ? 'textSecondary' : 'accent'}
                />
              </Pressable>
            );
          }}
        />
        <View
          style={[
            styles.bottom,
            { borderTopColor: theme.border, paddingBottom: Spacing.two + insets.bottom },
          ]}>
          <Button
            label={added.length ? `Done, ${added.length} added` : 'Done'}
            icon="checkmark"
            onPress={() => router.back()}
          />
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  top: {
    gap: Spacing.two,
    padding: Spacing.three,
    paddingBottom: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  chips: {
    gap: Spacing.two,
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: TapTarget,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  bottom: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
});
