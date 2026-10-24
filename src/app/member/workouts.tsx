import { router } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { useActiveGym } from '@/features/auth/use-profile';
import { ExerciseLibrary } from '@/features/exercises/components/exercise-library';
import { useWorkoutDraft } from '@/features/progress/draft-store';
import { WorkoutCard } from '@/features/workouts/components/workout-card';
import { useWorkouts } from '@/features/workouts/hooks';

type Tab = 'plans' | 'exercises';

export default function MemberWorkoutsScreen() {
  const gym = useActiveGym();
  const [tab, setTab] = useState<Tab>('plans');

  return (
    <Screen>
      <SegmentedControl
        options={[
          { value: 'plans', label: 'Plans' },
          { value: 'exercises', label: 'Exercises' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'plans' ? <Plans gymId={gym.gymId} /> : <ExerciseLibrary gymId={gym.gymId} />}
    </Screen>
  );
}

function Plans({ gymId }: { gymId: string }) {
  const workouts = useWorkouts(gymId);
  const draft = useWorkoutDraft((s) => s.draft);
  const start = useWorkoutDraft((s) => s.start);

  return (
    <>
      {draft ? (
        <Card highlighted>
          <ThemedText type="label" themeColor="primary">
            In progress
          </ThemedText>
          <ThemedText type="heading">{draft.title}</ThemedText>
          <Button
            label="Resume workout"
            icon="play"
            onPress={() => router.push('/workout-session')}
          />
        </Card>
      ) : null}
      <QueryState query={workouts} isEmpty={(w) => w.length === 0} emptyText="No plans yet.">
        {(list) =>
          list.map((workout) => (
            <WorkoutCard
              key={workout.id}
              workout={workout}
              action={
                draft ? undefined : (
                  <Button
                    label="Start workout"
                    icon="play"
                    size="compact"
                    onPress={() => {
                      start(gymId, workout);
                      router.push('/workout-session');
                    }}
                  />
                )
              }
            />
          ))
        }
      </QueryState>
    </>
  );
}
