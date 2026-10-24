import { router } from 'expo-router';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { QueryState } from '@/components/query-state';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { useProfile } from '@/features/auth/use-profile';
import { useWorkoutDraft } from '@/features/progress/draft-store';
import { WorkoutCard } from '@/features/workouts/components/workout-card';
import { useWorkouts } from '@/features/workouts/hooks';
import type { Workout } from '@/features/workouts/types';

/** The workout in progress, or the gym's plans to start one from. Anyone at the gym can train. */
export function StartWorkout({ gymId }: { gymId: string }) {
  const profile = useProfile();
  const workouts = useWorkouts(gymId);
  const draft = useWorkoutDraft((s) => s.draft);
  const start = useWorkoutDraft((s) => s.start);

  const card = (workout: Workout) => (
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
  );

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
        {(list) => {
          const mine = list.filter((w) => w.assignedMemberIds.includes(profile.id));
          const others = list.filter((w) => !mine.includes(w));
          return (
            <>
              {mine.length > 0 ? (
                <>
                  <SectionHeader title="From your trainer" detail={`${mine.length} assigned`} />
                  {mine.map(card)}
                </>
              ) : null}
              {others.length > 0 ? (
                <>
                  <SectionHeader title={mine.length > 0 ? 'More plans' : 'Gym plans'} />
                  {others.map(card)}
                </>
              ) : null}
            </>
          );
        }}
      </QueryState>
    </>
  );
}
