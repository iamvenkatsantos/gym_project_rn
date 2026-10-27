import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { SegmentedControl } from '@/components/segmented-control';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { MealEditor } from '@/features/diet/components/meal-editor';
import { useDeleteMealPlan, useMealPlan, useSaveMealPlan } from '@/features/diet/hooks';
import {
  addMeal,
  DietLimits,
  draftFromMealPlan,
  emptyMealPlan,
  foodTypes,
  macroCalories,
  mealPlanInput,
  mealPlanProblem,
  mealPresets,
  moveMeal,
  removeMeal,
  targetFields,
  targetProblem,
  updateMeal,
  type MealPlanDraft,
} from '@/features/diet/plan-draft';
import { validateOptionalText, validateTitle } from '@/lib/validation';

export default function MealPlanEditorScreen() {
  const { planId } = useLocalSearchParams<{ planId?: string }>();
  const profile = useProfile();
  const gym = useActiveGym();
  const { plan, isPending } = useMealPlan(gym.gymId, profile.id, planId);

  if (!planId)
    return <MealPlanForm gymId={gym.gymId} coachId={profile.id} initial={emptyMealPlan()} />;

  if (!plan) {
    return (
      <Screen refreshable={false}>
        <ThemedText themeColor="textSecondary">
          {isPending ? 'Loading…' : 'Plan not found.'}
        </ThemedText>
      </Screen>
    );
  }

  return (
    <MealPlanForm
      key={plan.id}
      gymId={gym.gymId}
      coachId={profile.id}
      planId={plan.id}
      initial={draftFromMealPlan(plan)}
    />
  );
}

function MealPlanForm({
  gymId,
  coachId,
  planId,
  initial,
}: {
  gymId: string;
  coachId: string;
  planId?: string;
  initial: MealPlanDraft;
}) {
  const [draft, setDraft] = useState(initial);
  const [showProblem, setShowProblem] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = useSaveMealPlan();
  const remove = useDeleteMealPlan();
  const problem = mealPlanProblem(draft);
  const input = problem ? null : mealPlanInput(draft);
  const fromMacros = input ? macroCalories(input.targets) : null;

  const onSave = () => {
    if (!input) {
      setShowProblem(true);
      return;
    }
    save.mutate(
      { gymId, coachId, planId: planId ?? null, plan: input },
      {
        onSuccess: (id) =>
          planId
            ? router.back()
            : router.replace({ pathname: '/assign-meal-plan/[planId]', params: { planId: id } }),
      },
    );
  };

  return (
    <Screen refreshable={false}>
      <Stack.Screen options={{ title: planId ? 'Edit diet plan' : 'New diet plan' }} />
      <TextField
        label="Plan name"
        placeholder="e.g. Fat loss, vegetarian"
        value={draft.title}
        onChangeText={(title) => setDraft((d) => ({ ...d, title }))}
        maxLength={80}
        error={validateTitle(draft.title, { label: 'plan name' })}
        showError={showProblem}
      />
      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary">
          Food type
        </ThemedText>
        <SegmentedControl
          options={foodTypes}
          value={draft.foodType}
          onChange={(foodType) => setDraft((d) => ({ ...d, foodType }))}
        />
      </View>

      <SectionHeader title="Daily targets" detail="Optional" />
      <View style={styles.grid}>
        {targetFields.map((f) => (
          <View key={f.key} style={styles.cell}>
            <TextField
              label={`${f.label} (${f.unit})`}
              placeholder={f.key === 'calories' ? 'e.g. 2200' : 'e.g. 120'}
              value={draft.targets[f.key]}
              onChangeText={(text) =>
                setDraft((d) => ({ ...d, targets: { ...d.targets, [f.key]: text } }))
              }
              keyboardType="number-pad"
              maxLength={4}
              error={targetProblem(draft, f.key)}
              showError={showProblem}
            />
          </View>
        ))}
      </View>
      {fromMacros !== null ? (
        <ThemedText type="small" themeColor="textSecondary">
          The macros add up to about {fromMacros} kcal.
        </ThemedText>
      ) : null}

      <SectionHeader title="Meals" detail={`${draft.meals.length} a day`} />
      {draft.meals.map((meal, i) => (
        <MealEditor
          key={meal.key}
          meal={meal}
          position={i + 1}
          isFirst={i === 0}
          isLast={i === draft.meals.length - 1}
          showErrors={showProblem}
          onChange={(patch) => setDraft((d) => updateMeal(d, i, patch))}
          onMove={(by) => setDraft((d) => moveMeal(d, i, by))}
          onRemove={() => setDraft((d) => removeMeal(d, i))}
        />
      ))}
      {draft.meals.length < DietLimits.meals ? (
        <View style={styles.field}>
          <ThemedText type="label" themeColor="textSecondary">
            Add a meal
          </ThemedText>
          <View style={styles.chips}>
            {mealPresets.map((name) => (
              <Chip
                key={name}
                label={name}
                selected={false}
                onPress={() => setDraft((d) => addMeal(d, name))}
              />
            ))}
            <Chip label="Other" selected={false} onPress={() => setDraft((d) => addMeal(d))} />
          </View>
        </View>
      ) : null}

      <TextField
        label="Notes (optional)"
        placeholder="Water, supplements, foods to avoid, swaps"
        value={draft.notes}
        onChangeText={(notes) => setDraft((d) => ({ ...d, notes }))}
        multiline
        maxLength={DietLimits.notes}
        error={validateOptionalText(draft.notes, DietLimits.notes)}
      />

      {showProblem && problem ? <ThemedText themeColor="danger">{problem}</ThemedText> : null}
      {save.error ? (
        <ThemedText themeColor="danger">Couldn&apos;t save: {save.error.message}</ThemedText>
      ) : null}
      <Button
        label={planId ? 'Save changes' : 'Create diet plan'}
        icon="checkmark"
        loading={save.isPending}
        onPress={onSave}
      />

      {planId ? (
        confirmDelete ? (
          <Card>
            <ThemedText type="smallBold">Delete this diet plan?</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Members on it will no longer have a diet plan.
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
                  onPress={() => remove.mutate(planId, { onSuccess: () => router.back() })}
                />
              </View>
            </View>
          </Card>
        ) : (
          <Button
            label="Delete diet plan"
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  cell: {
    flexGrow: 1,
    flexBasis: '45%',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
