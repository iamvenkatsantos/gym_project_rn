import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { ClassRow } from '@/features/bookings/components/class-row';
import { useUpcomingClasses } from '@/features/bookings/hooks';
import { SessionRow } from '@/features/trainers/components/session-row';
import { weeklyHours } from '@/features/trainers/availability-rules';
import { useSessions, useUpdateSession, useWeeklyHours } from '@/features/trainers/hooks';

export default function TrainerScheduleScreen() {
  const profile = useProfile();
  const gym = useActiveGym();
  const sessions = useSessions(gym.gymId, { trainerId: profile.id });
  const classes = useUpcomingClasses(gym.gymId, profile.id);
  const update = useUpdateSession();
  const hours = useWeeklyHours(gym.gymId, profile.id);

  return (
    <Screen>
      <Card>
        <View style={styles.hours}>
          <Icon name="time-outline" size={24} color="primary" />
          <View style={styles.flex}>
            <ThemedText type="smallBold">Bookable hours</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {hours.data
                ? hours.data.availability.length
                  ? `${weeklyHours(hours.data.availability)} h a week · ${hours.data.sessionMinutes} min sessions`
                  : 'Not set, so members can’t book you yet'
                : 'Loading…'}
            </ThemedText>
          </View>
          <Button
            label="Edit"
            variant="secondary"
            size="compact"
            onPress={() => router.push('/weekly-hours')}
          />
        </View>
      </Card>

      <SectionHeader
        title="1:1 sessions"
        detail={sessions.data ? `${sessions.data.length} upcoming` : undefined}
      />
      <QueryState
        query={sessions}
        isEmpty={(list) => list.length === 0}
        emptyText="No personal training booked.">
        {(list) =>
          list.map((session, i) => {
            const started = new Date(session.startsAt) <= new Date();
            return (
              <SessionRow
                key={session.id}
                session={session}
                show="member"
                highlighted={i === 0}
                action={
                  started ? (
                    <Button
                      label="Mark as done"
                      icon="checkmark-done-outline"
                      size="compact"
                      loading={update.isPending && update.variables?.sessionId === session.id}
                      onPress={() => update.mutate({ sessionId: session.id, status: 'completed' })}
                    />
                  ) : undefined
                }
              />
            );
          })
        }
      </QueryState>

      <SectionHeader title="Classes" />
      <QueryState query={classes} isEmpty={(c) => c.length === 0} emptyText="No classes scheduled.">
        {(list) =>
          list
            .slice(0, 6)
            .map((gymClass) => <ClassRow key={gymClass.id} gymClass={gymClass} showDay />)
        }
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hours: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
});
