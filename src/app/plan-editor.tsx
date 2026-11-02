import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { SegmentedControl } from '@/components/segmented-control';
import { Stepper } from '@/components/stepper';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { useExercises } from '@/features/exercises/hooks';
import {
  useDeleteSelfWorkout,
  useSaveSelfWorkout,
  useSelfPlans,
} from '@/features/self-workouts/hooks';
import { DayPicker } from '@/features/workouts/components/day-picker';
import { useExercisePicks } from '@/features/workouts/exercise-picks';
import { PlanExerciseEditor } from '@/features/workouts/components/plan-exercise-editor';
import { useDeleteWorkout, useSaveWorkout, useWorkout } from '@/features/workouts/hooks';
import {
  addExercise,
  emptyPlan,
  moveExercise,
  planFromWorkout,
  planProblem,
  PlanLimits,
  removeExercise,
  setDuration,
  updateExercise,
  type PlanDraft,
} from '@/features/workouts/plan-draft';
import { daysLabel } from '@/features/workouts/schedule';
import { draftFromSmartPlan, smartPlans } from '@/features/workouts/smart-plans';
import type { WorkoutLevel } from '@/features/workouts/types';
import { firstError, validateOptionalText, validateTitle } from '@/lib/validation';

export default function PlanEditorScreen() {
  const { workoutId, smartPlanId, memberId } = useLocalSearchParams<{
    workoutId?: string;
    smartPlanId?: string;
    /** Set for a member's own plan (self workouts): the member, or their trainer, edits it. */
    memberId?: string;
  }>();
  const profile = useProfile();
  const gym = useActiveGym();
  if (memberId)
    return <SelfPlanEditor gymId={gym.gymId} memberId={memberId} workoutId={workoutId} />;
  return (
    <CoachPlanEditor
      gymId={gym.gymId}
      coachId={profile.id}
      workoutId={workoutId}
      smartPlanId={smartPlanId}
    />
  );
}

/** One of a member's own plans, with the days they do it. */
function SelfPlanEditor({
  gymId,
  memberId,
  workoutId,
}: {
  gymId: string;
  memberId: string;
  workoutId?: string;
}) {
  const { plans, isPending } = useSelfPlans(gymId, memberId);
  const workout = plans?.find((w) => w.id === workoutId);
  if (!workoutId) {
    return (
      <PlanForm
        gymId={gymId}
        trainerId={memberId}
        initial={emptyPlan()}
        self={{ memberId, days: [] }}
      />
    );
  }
  if (!workout) {
    return (
      <Screen refreshable={false}>
        <ThemedText themeColor="textSecondary">
          {isPending ? 'Loading…' : 'Plan not found.'}
        </ThemedText>
      </Screen>
    );
  }
  return (
    <PlanForm
      key={workout.id}
      gymId={gymId}
      trainerId={memberId}
      workoutId={workout.id}
      initial={planFromWorkout(workout)}
      self={{ memberId, days: workout.memberDays[memberId] ?? [] }}
    />
  );
}

function CoachPlanEditor({
  gymId,
  coachId,
  workoutId,
  smartPlanId,
}: {
  gymId: string;
  coachId: string;
  workoutId?: string;
  smartPlanId?: string;
}) {
  const { workout, isPending } = useWorkout(gymId, coachId, workoutId);
  const exercises = useExercises(gymId);
  const smartPlan = smartPlans.find((p) => p.id === smartPlanId);

  if (smartPlan && !workoutId) {
    if (!exercises.data) {
      return (
        <Screen refreshable={false}>
          <ThemedText themeColor="textSecondary">
            {exercises.error ? `Couldn't load exercises: ${exercises.error.message}` : 'Loading…'}
          </ThemedText>
        </Screen>
      );
    }
    return (
      <PlanForm
        key={smartPlan.id}
        gymId={gymId}
        trainerId={coachId}
        initial={draftFromSmartPlan(smartPlan, exercises.data)}
      />
    );
  }

  if (!workoutId) return <PlanForm gymId={gymId} trainerId={coachId} initial={emptyPlan()} />;

  if (!workout) {
    return (
      <Screen refreshable={false}>
        <ThemedText themeColor="textSecondary">
          {isPending ? 'Loading…' : 'Plan not found.'}
        </ThemedText>
      </Screen>
    );
  }

  return (
    <PlanForm
      key={workout.id}
      gymId={gymId}
      trainerId={coachId}
      workoutId={workout.id}
      initial={planFromWorkout(workout)}
    />
  );
}

function PlanForm({
  gymId,
  trainerId,
  workoutId,
  initial,
  self,
}: {
  gymId: string;
  trainerId: string;
  workoutId?: string;
  initial: PlanDraft;
  /** A member's own plan: saved with its days, not assigned afterwards. */
  self?: { memberId: string; days: number[] };
}) {
  const [plan, setPlan] = useState(initial);
  const [days, setDays] = useState(self?.days ?? []);
  const [showProblem, setShowProblem] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saveCoach = useSaveWorkout();
  const removeCoach = useDeleteWorkout();
  const saveSelf = useSaveSelfWorkout();
  const removeSelf = useDeleteSelfWorkout();
  const save = self ? saveSelf : saveCoach;
  const remove = self ? removeSelf : removeCoach;
  const openPicks = useExercisePicks((st) => st.open);
  const titleError = validateTitle(plan.title, { label: 'plan name' });
  const descriptionError = validateOptionalText(plan.description, 500);
  const problem = firstError(titleError, descriptionError, planProblem(plan));

  const onSave = () => {
    if (problem) {
      setShowProblem(true);
      return;
    }
    if (self) {
      saveSelf.mutate(
        { gymId, memberId: self.memberId, workoutId: workoutId ?? null, plan, days },
        { onSuccess: () => router.back() },
      );
      return;
    }
    saveCoach.mutate(
      { gymId, trainerId, workoutId: workoutId ?? null, plan },
      {
        onSuccess: (id) =>
          workoutId
            ? router.back()
            : router.replace({ pathname: '/assign-plan/[workoutId]', params: { workoutId: id } }),
      },
    );
  };

  return (
    <Screen refreshable={false}>
      <Stack.Screen options={{ title: workoutId ? 'Edit plan' : 'New plan' }} />
      <TextField
        label="Plan name"
        placeholder="e.g. Upper body push"
        value={plan.title}
        onChangeText={(title) => setPlan((p) => ({ ...p, title }))}
        maxLength={80}
        error={titleError}
        showError={showProblem}
      />
      <TextField
        label="Description"
        placeholder="Who it's for and what it works on"
        value={plan.description}
        onChangeText={(description) => setPlan((p) => ({ ...p, description }))}
        multiline
        maxLength={500}
        error={descriptionError}
      />
      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary">
          Level
        </ThemedText>
        <SegmentedControl<WorkoutLevel>
          options={[
            { value: 'beginner', label: 'Beginner' },
            { value: 'intermediate', label: 'Intermediate' },
            { value: 'advanced', label: 'Advanced' },
          ]}
          value={plan.level}
          onChange={(level) => setPlan((p) => ({ ...p, level }))}
        />
      </View>
      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary">
          Duration
        </ThemedText>
        <Stepper
          label="Duration"
          value={plan.durationMinutes}
          step={5}
          {...PlanLimits.durationMinutes}
          format={(m) => `${m} min`}
          onChange={(m) => setPlan((p) => setDuration(p, m))}
        />
      </View>
      {self ? (
        <View style={styles.field}>
          <ThemedText type="label" themeColor="textSecondary">
            Days: {daysLabel(days)}
          </ThemedText>
          <DayPicker label="Plan days" days={days} onChange={setDays} />
        </View>
      ) : null}

      <SectionHeader title="Exercises" detail={`${plan.exercises.length} in this plan`} />
      {plan.exercises.map((exercise, i) => (
        <PlanExerciseEditor
          key={exercise.exerciseId}
          exercise={exercise}
          position={i + 1}
          isFirst={i === 0}
          isLast={i === plan.exercises.length - 1}
          onChange={(patch) => setPlan((p) => updateExercise(p, i, patch))}
          onMove={(by) => setPlan((p) => moveExercise(p, i, by))}
          onRemove={() => setPlan((p) => removeExercise(p, i))}
        />
      ))}
      <Button
        label="Add exercises"
        icon="add-circle-outline"
        variant="secondary"
        onPress={() => {
          openPicks(
            plan.exercises.map((e) => e.exerciseId),
            (exercise) => setPlan((p) => addExercise(p, exercise)),
          );
          router.push('/add-exercises');
        }}
      />

      {showProblem && problem ? <ThemedText themeColor="danger">{problem}</ThemedText> : null}
      {save.error ? (
        <ThemedText themeColor="danger">Couldn&apos;t save: {save.error.message}</ThemedText>
      ) : null}
      <Button
        label={workoutId ? 'Save changes' : 'Create plan'}
        icon="checkmark"
        loading={save.isPending}
        onPress={onSave}
      />

      {workoutId ? (
        confirmDelete ? (
          <Card>
            <ThemedText type="smallBold">Delete this plan?</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {self
                ? 'Logged workouts are kept.'
                : 'Members it’s assigned to will lose it. Their logged workouts are kept.'}
            </ThemedText>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Button
                  label="Keep it"
                  variant="secondary"
                  size="compact"
                  onPress={() => setConfirmDelete(false)}
                />
              </View>
              <View style={styles.flex}>
                <Button
                  label="Delete"
                  variant="danger"
                  size="compact"
                  loading={remove.isPending}
                  onPress={() => remove.mutate(workoutId, { onSuccess: () => router.back() })}
                />
              </View>
            </View>
          </Card>
        ) : (
          <Button
            label="Delete plan"
            variant="danger"
            size="compact"
            onPress={() => setConfirmDelete(true)}
          />
        )
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
