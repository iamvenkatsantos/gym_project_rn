import { router } from 'expo-router';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { QueryState } from '@/components/query-state';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { useAnnounceWorkoutStart, useMyAttendance } from '@/features/attendance/hooks';
import { canStartWorkout } from '@/features/attendance/rules';
import { useWorkoutDraft } from '@/features/progress/draft-store';
import { WorkoutCard } from '@/features/workouts/components/workout-card';
import { useWorkouts } from '@/features/workouts/hooks';
import type { Workout } from '@/features/workouts/types';

/**
 * The workout in progress, or the gym's plans to start one from. Anyone at the gym can train;
 * members have to check in first, and starting tells their trainers.
 */
export function StartWorkout({ gymId }: { gymId: string }) {
  const profile = useProfile();
  const gym = useActiveGym();
  const workouts = useWorkouts(gymId);
  const draft = useWorkoutDraft((s) => s.draft);
  const start = useWorkoutDraft((s) => s.start);
  const discard = useWorkoutDraft((s) => s.discard);
  const isMember = gym.role === 'member';
  const attendance = useMyAttendance(gymId, profile.id);
  const announce = useAnnounceWorkoutStart(gymId);
  const checkedIn = !isMember || canStartWorkout(attendance.data);

  const begin = (workout: Workout) => {
    start(gymId, workout);
    if (!isMember) {
      router.push('/workout-session');
      return;
    }
    const started = useWorkoutDraft.getState().draft;
    if (!started) return;
    announce.mutate(started, {
      onSuccess: () => router.push('/workout-session'),
      onError: (error) => {
        // Only the server saying they aren't checked in stops the workout; no signal
        // in the gym shouldn't.
        if (error.message.includes('Check in first')) discard();
        else router.push('/workout-session');
      },
    });
  };

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
            disabled={!checkedIn || announce.isPending}
            loading={announce.isPending && announce.variables?.title === workout.title}
            onPress={() => begin(workout)}
          />
        )
      }
    />
  );

  return (
    <>
      {!draft && !checkedIn ? (
        <Card>
          <ThemedText type="smallBold">Check in to start a workout</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {announce.error?.message.includes('Check in first')
              ? 'You’re checked out. Check in again on Home to keep training.'
              : 'Tap Check in on Home when you arrive at the gym.'}
          </ThemedText>
          <Button
            label="Go to Home"
            icon="home-outline"
            variant="secondary"
            size="compact"
            onPress={() => router.navigate('/member')}
          />
        </Card>
      ) : null}
      {draft ? (
        <Card highlighted>
          <ThemedText type="label" themeColor="accent">
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
