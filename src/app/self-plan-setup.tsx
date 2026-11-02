import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { useExercises } from '@/features/exercises/hooks';
import {
  useCreateSelfPlan,
  useSelfPlans,
  useSelfPrefs,
  useSelfWorkoutsOn,
} from '@/features/self-workouts/hooks';
import {
  buildSelfPlans,
  goalOptions,
  prefsProblem,
  splitPlanNames,
} from '@/features/self-workouts/rules';
import type { SelfPrefs, SelfSplit } from '@/features/self-workouts/types';
import { DayPicker } from '@/features/workouts/components/day-picker';
import { daysLabel } from '@/features/workouts/schedule';
import type { WorkoutLevel } from '@/features/workouts/types';
import { useTheme } from '@/hooks/use-theme';

const defaults: SelfPrefs = {
  goal: 'stay_fit',
  level: 'beginner',
  days: [1, 3, 5],
  split: 'full_body',
};

/** Four questions, then the app builds the member's week from the smart plans. */
export default function SelfPlanSetupScreen() {
  const profile = useProfile();
  const gym = useActiveGym();
  const prefs = useSelfPrefs(gym.gymId, profile.id);
  const self = useSelfWorkoutsOn(gym.gymId, profile.id);

  if (prefs.isPending || self.isPending) {
    return (
      <Screen refreshable={false}>
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      </Screen>
    );
  }
  if (!self.on) {
    return (
      <Screen refreshable={false}>
        <ThemedText themeColor="textSecondary">
          Ask your trainer to turn on self workouts.
        </ThemedText>
      </Screen>
    );
  }
  return <SetupForm gymId={gym.gymId} memberId={profile.id} initial={prefs.data ?? defaults} />;
}

function Option({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}, ${hint}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        {
          borderColor: selected ? theme.accent : theme.border,
          backgroundColor: theme.backgroundElement,
        },
        pressed && styles.pressed,
      ]}>
      <View style={styles.flex}>
        <ThemedText type="smallBold">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      </View>
      <Icon
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={22}
        color={selected ? 'accent' : 'textSecondary'}
      />
    </Pressable>
  );
}

function SetupForm({
  gymId,
  memberId,
  initial,
}: {
  gymId: string;
  memberId: string;
  initial: SelfPrefs;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [showProblem, setShowProblem] = useState(false);
  const exercises = useExercises(gymId);
  const existing = useSelfPlans(gymId, memberId).plans ?? [];
  const create = useCreateSelfPlan(gymId, memberId);
  const daysError = prefsProblem(prefs);
  const plans = exercises.data ? buildSelfPlans(prefs, exercises.data) : [];
  const problem =
    daysError ??
    (exercises.data && plans.length === 0 ? 'No matching exercises at your gym.' : null);

  const onCreate = () => {
    if (problem || !exercises.data) {
      setShowProblem(true);
      return;
    }
    create.mutate({ prefs, plans }, { onSuccess: () => router.replace('/self-plan') });
  };

  return (
    <Screen refreshable={false}>
      <Stack.Screen options={{ title: existing.length ? 'Re-create my plan' : 'Set up my plan' }} />
      <ThemedText type="label" themeColor="textSecondary">
        Your goal
      </ThemedText>
      {goalOptions.map((g) => (
        <Option
          key={g.value}
          label={g.label}
          hint={g.hint}
          selected={prefs.goal === g.value}
          onPress={() => setPrefs((p) => ({ ...p, goal: g.value }))}
        />
      ))}

      <ThemedText type="label" themeColor="textSecondary">
        Your level
      </ThemedText>
      <SegmentedControl<WorkoutLevel>
        options={[
          { value: 'beginner', label: 'Beginner' },
          { value: 'intermediate', label: 'Intermediate' },
          { value: 'advanced', label: 'Advanced' },
        ]}
        value={prefs.level}
        onChange={(level) => setPrefs((p) => ({ ...p, level }))}
      />

      <ThemedText type="label" themeColor="textSecondary">
        Workout days: {daysLabel(prefs.days)}
      </ThemedText>
      <DayPicker
        label="Workout days"
        days={prefs.days}
        onChange={(days) => setPrefs((p) => ({ ...p, days }))}
      />
      <ThemedText type="small" themeColor={showProblem && daysError ? 'danger' : 'textSecondary'}>
        {showProblem && daysError ? daysError : 'Pick 3 to 6 days.'}
      </ThemedText>

      <ThemedText type="label" themeColor="textSecondary">
        Your split
      </ThemedText>
      {(['full_body', 'split'] as SelfSplit[]).map((split) => (
        <Option
          key={split}
          label={split === 'full_body' ? 'Fewer, bigger sessions' : 'One area a day'}
          hint={splitPlanNames(prefs.level, split).join(', ')}
          selected={prefs.split === split}
          onPress={() => setPrefs((p) => ({ ...p, split }))}
        />
      ))}

      {existing.length ? (
        <ThemedText type="small" themeColor="warning">
          This replaces your current plans and edits.
        </ThemedText>
      ) : null}
      {showProblem && problem && problem !== daysError ? (
        <ThemedText themeColor="danger">{problem}</ThemedText>
      ) : null}
      {create.error ? (
        <ThemedText themeColor="danger">Couldn&apos;t save: {create.error.message}</ThemedText>
      ) : null}
      <Button
        label={existing.length ? 'Re-create my plan' : 'Create my plan'}
        icon="sparkles-outline"
        loading={create.isPending}
        disabled={!exercises.data}
        onPress={onCreate}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: TapTarget,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: 1,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
