import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Pill } from '@/components/pill';
import { QueryState } from '@/components/query-state';
import { SectionHeader } from '@/components/section-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { canManageGym, type Role } from '@/features/auth/types';
import { useAssignPlan, useTrainerLinks } from '@/features/coaching/hooks';
import { useReplyToWorkout, useWorkoutLogs } from '@/features/progress/hooks';
import type { WorkoutLog } from '@/features/progress/types';
import { SelfCheckLines } from '@/features/self-workouts/components/self-check-lines';
import { useSelfPlans, useSelfPrefs, useSetSelfWorkouts } from '@/features/self-workouts/hooks';
import { NOTE_MAX, prefsSummary } from '@/features/self-workouts/rules';
import { useWorkouts } from '@/features/workouts/hooks';
import { formatRelativeDay } from '@/lib/format';

/** Self-checks shown before "Show more". */
const CHECKS_SHOWN = 5;

/**
 * A member's self workouts as their coach sees them: the switch (their own trainers only),
 * the member's own week, the coach's plans to map, and each workout's self-check to reply to.
 * Owners and supervisors see and reply; only the member's trainers switch it or map plans.
 */
export function CoachSelfWorkouts({
  gymId,
  memberId,
  memberName,
  viewer,
}: {
  gymId: string;
  memberId: string;
  memberName: string;
  viewer: { id: string; name: string; role: Role };
}) {
  const links = useTrainerLinks(gymId, { memberId });
  const myLink = links.data?.find((l) => l.trainerId === viewer.id);
  const on = links.data?.some((l) => l.selfWorkouts) ?? false;
  const setOn = useSetSelfWorkouts(gymId, memberId, viewer.id);
  const prefs = useSelfPrefs(gymId, memberId);
  const { plans } = useSelfPlans(gymId, memberId);
  const logs = useWorkoutLogs(gymId, memberId);
  const canReply = !!myLink || canManageGym(viewer.role);
  const [showAll, setShowAll] = useState(false);

  return (
    <>
      <Card>
        <View style={styles.row}>
          <ThemedText type="heading" style={styles.flex}>
            Self workouts
          </ThemedText>
          <Pill label={on ? 'On' : 'Off'} tone={on ? 'success' : 'neutral'} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {on
            ? `${memberName} plans and runs their own workouts.`
            : `Let ${memberName} plan their own workouts.`}
        </ThemedText>
        {prefs.data ? (
          <ThemedText type="small" themeColor="textSecondary">
            {prefsSummary(prefs.data)}
          </ThemedText>
        ) : null}
        {setOn.error ? (
          <ThemedText type="small" themeColor="danger">
            {setOn.error.message}
          </ThemedText>
        ) : null}
        <View style={styles.row}>
          {myLink ? (
            <View style={styles.flex}>
              <Button
                label={myLink.selfWorkouts ? 'Turn off' : 'Turn on'}
                icon={myLink.selfWorkouts ? 'pause-outline' : 'sparkles-outline'}
                variant={myLink.selfWorkouts ? 'secondary' : 'primary'}
                size="compact"
                loading={setOn.isPending}
                onPress={() => setOn.mutate(!myLink.selfWorkouts)}
              />
            </View>
          ) : null}
          {(plans ?? []).length > 0 ? (
            <View style={styles.flex}>
              <Button
                label={`Their plan (${plans?.length})`}
                icon="calendar-outline"
                variant="secondary"
                size="compact"
                onPress={() =>
                  router.push({ pathname: '/self-plan', params: { memberId, name: memberName } })
                }
              />
            </View>
          ) : null}
        </View>
        {!myLink && !on ? (
          <ThemedText type="small" themeColor="textSecondary">
            Only {memberName}&apos;s trainers can turn it on.
          </ThemedText>
        ) : null}
      </Card>

      {myLink ? <MapMyPlans gymId={gymId} memberId={memberId} coachId={viewer.id} /> : null}

      <SectionHeader title="Self-checks" />
      <QueryState
        query={logs}
        isEmpty={(list) => !list.some((l) => l.selfCheck)}
        emptyText="Self-checks after each workout show up here.">
        {(list) => {
          const checked = list.filter((l) => l.selfCheck);
          const shown = showAll ? checked : checked.slice(0, CHECKS_SHOWN);
          return (
            <>
              {shown.map((log) => (
                <CheckCard
                  key={log.clientId}
                  log={log}
                  gymId={gymId}
                  memberId={memberId}
                  viewerName={viewer.name}
                  canReply={canReply}
                />
              ))}
              {checked.length > shown.length ? (
                <Button
                  label={`Show ${checked.length - shown.length} more`}
                  variant="secondary"
                  size="compact"
                  onPress={() => setShowAll(true)}
                />
              ) : null}
            </>
          );
        }}
      </QueryState>
    </>
  );
}

/** The coach's own plans, to give the member one of them too. */
function MapMyPlans({
  gymId,
  memberId,
  coachId,
}: {
  gymId: string;
  memberId: string;
  coachId: string;
}) {
  const mine = useWorkouts(gymId, coachId);
  const assign = useAssignPlan(gymId, coachId);
  const plans = (mine.data ?? []).filter((w) => !w.isSelf);
  if (plans.length === 0) return null;
  return (
    <Card>
      <ThemedText type="smallBold">Map one of your plans</ThemedText>
      {plans.map((w) => {
        const assigned = w.assignedMemberIds.includes(memberId);
        return (
          <View key={w.id} style={styles.row}>
            <ThemedText type="small" style={styles.flex} numberOfLines={1}>
              {w.title}
            </ThemedText>
            <Button
              label={assigned ? 'Mapped' : 'Map'}
              icon={assigned ? 'checkmark' : 'add'}
              variant={assigned ? 'primary' : 'secondary'}
              size="compact"
              loading={assign.isPending && assign.variables?.workoutId === w.id}
              onPress={() =>
                assign.mutate({ workoutId: w.id, memberId, assigned: !assigned, mapFirst: false })
              }
            />
          </View>
        );
      })}
    </Card>
  );
}

function CheckCard({
  log,
  gymId,
  memberId,
  viewerName,
  canReply,
}: {
  log: WorkoutLog;
  gymId: string;
  memberId: string;
  viewerName: string;
  canReply: boolean;
}) {
  const reply = useReplyToWorkout(gymId, memberId, viewerName);
  const [text, setText] = useState('');

  return (
    <Card>
      <View style={styles.row}>
        <ThemedText type="smallBold" style={styles.flex}>
          {log.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatRelativeDay(log.completedAt)}
        </ThemedText>
      </View>
      <SelfCheckLines log={log} />
      {canReply && !log.reply ? (
        <>
          <TextField
            label="Reply"
            placeholder="e.g. Great work, add 2.5 kg next time"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={NOTE_MAX}
          />
          {reply.error ? (
            <ThemedText type="small" themeColor="danger">
              {reply.error.message}
            </ThemedText>
          ) : null}
          <Button
            label="Send reply"
            icon="send"
            size="compact"
            disabled={!text.trim()}
            loading={reply.isPending}
            onPress={() => reply.mutate({ clientId: log.clientId, text: text.trim() })}
          />
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
