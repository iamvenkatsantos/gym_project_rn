import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useProfile } from '@/features/auth/use-profile';
import { type DraftSet, useWorkoutDraft } from '@/features/progress/draft-store';
import { useFinishWorkout } from '@/features/progress/hooks';
import { useTheme } from '@/hooks/use-theme';

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function clock(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

function parseNumber(text: string) {
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export default function WorkoutSessionScreen() {
  const theme = useTheme();
  const profile = useProfile();
  const { draft, restUntil, toggleSet, updateSet, addSet, skipRest, discard } = useWorkoutDraft();
  const finish = useFinishWorkout(profile.id);
  const now = useNow();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  if (!draft) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">No workout in progress.</ThemedText>
        <Button label="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const doneSets = draft.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const totalSets = draft.exercises.reduce((n, e) => n + e.sets.length, 0);
  const resting = restUntil !== null && restUntil > now;

  const inputStyle = [
    styles.input,
    { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
  ];

  return (
    <Screen>
      <Stack.Screen options={{ title: clock(now - new Date(draft.startedAt).getTime()) }} />
      <View>
        <ThemedText type="title">{draft.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {doneSets} of {totalSets} sets done
        </ThemedText>
      </View>

      {resting ? (
        <Card highlighted style={styles.rest}>
          <Icon name="timer-outline" size={28} color="primary" />
          <View style={styles.flex}>
            <ThemedText type="label" themeColor="textSecondary">
              Rest
            </ThemedText>
            <ThemedText type="title" themeColor="primary">
              {clock(restUntil - now)}
            </ThemedText>
          </View>
          <Button label="Skip" variant="secondary" size="compact" onPress={skipRest} />
        </Card>
      ) : null}

      {draft.exercises.map((exercise, ei) => (
        <Card key={exercise.exerciseId}>
          <Pressable
            accessibilityRole="link"
            onPress={() =>
              router.push({
                pathname: '/exercise/[exerciseId]',
                params: { exerciseId: exercise.exerciseId },
              })
            }
            style={styles.exerciseHeader}>
            <ThemedText type="heading" style={styles.flex}>
              {exercise.name}
            </ThemedText>
            <Icon name="information-circle-outline" size={20} />
          </Pressable>

          <View style={styles.setRow}>
            <ThemedText type="label" themeColor="textSecondary" style={styles.setNumber}>
              Set
            </ThemedText>
            <ThemedText
              type="label"
              themeColor="textSecondary"
              style={[styles.flex, styles.center]}>
              Reps
            </ThemedText>
            <ThemedText
              type="label"
              themeColor="textSecondary"
              style={[styles.flex, styles.center]}>
              kg
            </ThemedText>
            <View style={styles.check} />
          </View>
          {exercise.sets.map((set: DraftSet, si) => (
            <View key={si} style={styles.setRow}>
              <ThemedText type="smallBold" style={styles.setNumber}>
                {si + 1}
              </ThemedText>
              <TextInput
                accessibilityLabel={`${exercise.name} set ${si + 1} reps`}
                keyboardType="number-pad"
                style={[inputStyle, styles.flex]}
                defaultValue={String(set.reps)}
                onEndEditing={(e) =>
                  updateSet(ei, si, { reps: parseNumber(e.nativeEvent.text) ?? set.reps })
                }
              />
              <TextInput
                accessibilityLabel={`${exercise.name} set ${si + 1} weight in kg`}
                keyboardType="decimal-pad"
                placeholder="BW"
                placeholderTextColor={theme.textSecondary}
                style={[inputStyle, styles.flex]}
                defaultValue={set.weightKg === null ? '' : String(set.weightKg)}
                onEndEditing={(e) =>
                  updateSet(ei, si, { weightKg: parseNumber(e.nativeEvent.text) })
                }
              />
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: set.done }}
                accessibilityLabel={`${exercise.name} set ${si + 1} done`}
                onPress={() => toggleSet(ei, si)}
                style={[
                  styles.check,
                  {
                    backgroundColor: set.done ? theme.primary : theme.backgroundSelected,
                  },
                ]}>
                <Icon name="checkmark" size={22} color={set.done ? 'onPrimary' : 'textSecondary'} />
              </Pressable>
            </View>
          ))}
          <Pressable accessibilityRole="button" onPress={() => addSet(ei)} style={styles.addSet}>
            <Icon name="add" size={18} color="primary" />
            <ThemedText type="linkPrimary">Add set</ThemedText>
          </Pressable>
        </Card>
      ))}

      <Button
        label={finish.isError ? 'Retry saving workout' : 'Finish workout'}
        icon="flag-outline"
        disabled={doneSets === 0}
        loading={finish.isPending}
        onPress={() =>
          finish.mutate(undefined, { onSuccess: () => router.replace('/member/progress') })
        }
      />
      {finish.error ? (
        <ThemedText themeColor="danger">
          Couldn&apos;t save: {finish.error.message}. Your workout is kept on this phone, so you can
          retry when you&apos;re back online.
        </ThemedText>
      ) : null}
      {confirmDiscard ? (
        <Card>
          <ThemedText type="smallBold">Discard this workout?</ThemedText>
          <View style={styles.setRow}>
            <View style={styles.flex}>
              <Button
                label="Keep going"
                variant="secondary"
                size="compact"
                onPress={() => setConfirmDiscard(false)}
              />
            </View>
            <View style={styles.flex}>
              <Button
                label="Discard"
                variant="danger"
                size="compact"
                onPress={() => {
                  discard();
                  router.back();
                }}
              />
            </View>
          </View>
        </Card>
      ) : (
        <Button
          label="Discard workout"
          variant="danger"
          size="compact"
          onPress={() => setConfirmDiscard(true)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  rest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 32,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  setNumber: {
    width: 32,
    textAlign: 'center',
  },
  input: {
    // Without this, web TextInputs keep their intrinsic width and overflow the row.
    minWidth: 0,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.two,
    fontSize: 16,
    textAlign: 'center',
  },
  check: {
    width: TapTarget - 8,
    height: 44,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    minHeight: 44,
  },
});
