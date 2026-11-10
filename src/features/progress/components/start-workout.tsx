import { router } from 'expo-router';
import { type ReactNode } from 'react';

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
import { WeeklyGoalCard } from '@/features/progress/components/weekly-goal-card';
import { useWorkoutDraft } from '@/features/progress/draft-store';
import { weeklyGoalSummary } from '@/features/progress/goal';
import { useWorkoutLogs } from '@/features/progress/hooks';
import { SelfWorkoutsCard } from '@/features/self-workouts/components/self-workouts-card';
import { useSelfWorkoutsOn } from '@/features/self-workouts/hooks';
import { WorkoutCard } from '@/features/workouts/components/workout-card';
import { useCatchUpDays, useWorkouts } from '@/features/workouts/hooks';
import {
  isDue,
  lastDoneByPlan,
  planDayStatus,
  statusLabel,
  type PlanDayStatus,
} from '@/features/workouts/schedule';
import type { Workout } from '@/features/workouts/types';

/**
 * The workout in progress, or the plans to start one from: a member's trainers' plans, or a
 * coach's own. Anyone at the gym can train; members need a current membership and to check
 * in first, and starting tells their trainers. Assigned plans with weekdays are only
 * startable on their days, or within the gym's catch-up days after a missed one.
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
  const logs = useWorkoutLogs(gymId, profile.id);
  const catchUp = useCatchUpDays(gymId);
  // Members' own plans only count while a trainer has self workouts on.
  const self = useSelfWorkoutsOn(gymId, profile.id);
  const selfOn = isMember && self.on === true;
  const goal =
    isMember && workouts.data && logs.data
      ? weeklyGoalSummary(
          workouts.data.filter(
            (w) => (!w.isSelf || selfOn) && w.assignedMemberIds.includes(profile.id),
          ),
          logs.data,
          profile.id,
        )
      : null;

  const begin = (workout: Workout) => {
    start(gymId, workout, profile.id);
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

  const statusOf = (workout: Workout): PlanDayStatus =>
    planDayStatus(
      workout.memberDays[profile.id] ?? [],
      new Date(),
      catchUp.data ?? 1,
      lastDoneByPlan(logs.data ?? []).get(workout.id) ?? null,
    );

  const card = (workout: Workout, status?: PlanDayStatus) => (
    <WorkoutCard
      key={workout.id}
      workout={workout}
      showAuthor={isMember && !workout.isSelf}
      dayLabel={status && status.kind !== 'anytime' ? statusLabel(status) : undefined}
      action={
        draft || (status && !isDue(status)) ? undefined : (
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
      {goal && !draft ? <WeeklyGoalCard summary={goal} /> : null}
      {selfOn && !draft ? (
        <SelfWorkoutsCard
          hasPlans={(workouts.data ?? []).some((w) => w.isSelf && w.trainerId === profile.id)}
        />
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
        isEmpty={(w) => w.filter((p) => !p.isSelf || selfOn).length === 0}
        emptyText={
          selfOn
            ? 'Set up your plan above.'
            : isMember
              ? 'Your trainer hasn’t shared any plans yet.'
              : 'No plans yet.'
        }>
        {(all) => {
          const list = all.filter((w) => !w.isSelf || selfOn);
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
                <AssignedPlans plans={mine} statusOf={statusOf} card={card} />
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
                  {others.map((w) => card(w))}
                </>
              ) : null}
            </>
          );
        }}
      </QueryState>
    </>
  );
}

/** A member's assigned plans: what's due today first, then the rest of the week. */
function AssignedPlans({
  plans,
  statusOf,
  card,
}: {
  plans: Workout[];
  statusOf: (workout: Workout) => PlanDayStatus;
  card: (workout: Workout, status: PlanDayStatus) => ReactNode;
}) {
  const withStatus = plans.map((workout) => ({ workout, status: statusOf(workout) }));
  const due = withStatus.filter((p) => isDue(p.status));
  const later = withStatus.filter((p) => !isDue(p.status));
  return (
    <>
      <SectionHeader title="Today" detail={`${due.length} to do`} />
      {due.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {later.length > 0 ? 'Rest day. Your next plans are below.' : 'Rest day.'}
        </ThemedText>
      ) : (
        due.map((p) => card(p.workout, p.status))
      )}
      {later.length > 0 ? (
        <>
          <SectionHeader title="This week" />
          {later.map((p) => card(p.workout, p.status))}
        </>
      ) : null}
    </>
  );
}
