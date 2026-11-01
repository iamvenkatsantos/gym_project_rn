import { router } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { starterExercises } from '@/features/exercises/library';
import { WorkoutCard } from '@/features/workouts/components/workout-card';
import { daysLabel } from '@/features/workouts/schedule';
import { draftFromSmartPlan, smartPlansFor } from '@/features/workouts/smart-plans';
import type { WorkoutLevel } from '@/features/workouts/types';

/** Ready-made plans by level. Using one copies it into a new plan to edit and assign. */
export default function SmartPlansScreen() {
  const [level, setLevel] = useState<WorkoutLevel>('beginner');

  return (
    <Screen>
      <SegmentedControl<WorkoutLevel>
        options={[
          { value: 'beginner', label: 'Beginner' },
          { value: 'intermediate', label: 'Intermediate' },
          { value: 'advanced', label: 'Advanced' },
        ]}
        value={level}
        onChange={setLevel}
      />
      <ThemedText type="small" themeColor="textSecondary">
        Copy one, set weights, then assign.
      </ThemedText>
      {smartPlansFor(level).map((plan) => (
        <WorkoutCard
          key={plan.id}
          workout={draftFromSmartPlan(plan, starterExercises)}
          dayLabel={`Try ${daysLabel(plan.suggestedDays)}`}
          action={
            <Button
              label="Use this plan"
              icon="copy-outline"
              size="compact"
              onPress={() =>
                router.push({ pathname: '/plan-editor', params: { smartPlanId: plan.id } })
              }
            />
          }
        />
      ))}
    </Screen>
  );
}
