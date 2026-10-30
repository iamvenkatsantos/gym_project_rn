import { router } from 'expo-router';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { QueryState } from '@/components/query-state';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { useAnnounceWorkoutStart, useMyAttendance } from '@/features/attendance/hooks';
import { canStartWorkout } from '@/features/attendance/rules';
import { NoMembershipNotice } from '@/features/memberships/components/no-membership-notice';
import { useHasMembership } from '@/features/memberships/hooks';
import { useWorkoutDraft } from '@/features/progress/draft-store';
import { WorkoutCard } from '@/features/workouts/components/workout-card';
import { useWorkouts } from '@/features/workouts/hooks';
import type { Workout } from '@/features/workouts/types';

/**
 * The workout in progress, or the plans to start one from: a member's trainers' plans, or a
 * coach's own. Anyone at the gym can train; members need a current membership and to check
 * in first, and starting tells their trainers.
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
  const hasMembership = useHasMembership(gymId, profile.id, gym.role);
  const checkedIn = !isMember || canStartWorkout(attendance.data);
  const canStart = checkedIn && hasMembership !== false;

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
        // Only the server saying they aren't checked in (or have no membership) stops the
        // workout; no signal in the gym shouldn't.
        if (/Check in first|No active membership/.test(error.message)) discard();
        else router.push('/workout-session');
      },
    });
  };

  const card = (workout: Workout) => (
    <WorkoutCard
      key={workout.id}
      workout={workout}
      showAuthor={isMember}
      action={
        draft ? undefined : (
          <Button
            label="Start workout"
            icon="play"
            size="compact"
            disabled={!canStart || announce.isPending}
            loading={announce.isPending && announce.variables?.title === workout.title}
            onPress={() => begin(workout)}
          />
        )
      }
    />
  );

  return (
    <>
      {!draft && hasMembership === false ? (
        <NoMembershipNotice action="start a workout" />
      ) : !draft && !checkedIn ? (
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
      <QueryState
        query={workouts}
        isEmpty={(w) => w.length === 0}
        emptyText={isMember ? 'Your trainer hasn’t shared any plans yet.' : 'No plans yet.'}>
        {(list) => {
          const mine = list.filter((w) => w.assignedMemberIds.includes(profile.id));
          // Staff train from their own plans here; owners and supervisors review
          // other coaches' plans under Coaching.
          const others = list.filter(
            (w) => !mine.includes(w) && (isMember || w.trainerId === profile.id),
          );
          if (mine.length + others.length === 0) {
            return (
              <ThemedText type="small" themeColor="textSecondary">
                Plans you write under Coaching show up here.
              </ThemedText>
            );
          }
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
                  <SectionHeader
                    title={
                      isMember
                        ? mine.length > 0
                          ? 'More from your trainers'
                          : 'From your trainers'
                        : 'Your plans'
                    }
                  />
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
