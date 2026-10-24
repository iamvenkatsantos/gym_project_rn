import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Pill } from '@/components/pill';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTrainerLinks, useTrainerRequests } from '@/features/coaching/hooks';
import { openRequest } from '@/features/coaching/rules';
import { TrainerAvatar } from '@/features/trainers/components/trainer-avatar';

/** The member's trainers, and a way to ask the gym for one (or another one). */
export function YourTrainers({ gymId, memberId }: { gymId: string; memberId: string }) {
  const links = useTrainerLinks(gymId, { memberId });
  const requests = useTrainerRequests(gymId);
  const pending = requests.data ? openRequest(requests.data, memberId) : null;
  const trainers = links.data ?? [];

  return (
    <>
      <SectionHeader
        title={trainers.length > 1 ? 'Your trainers' : 'Your trainer'}
        detail={trainers.length ? `${trainers.length}` : undefined}
      />
      <Card>
        {trainers.length ? (
          trainers.map((link) => (
            <View key={link.trainerId} style={styles.row}>
              <TrainerAvatar name={link.trainerName} size={40} />
              <ThemedText type="smallBold" style={styles.flex}>
                {link.trainerName}
              </ThemedText>
              <Button
                label="Book"
                size="compact"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: '/book-trainer/[trainerId]',
                    params: { trainerId: link.trainerId },
                  })
                }
              />
            </View>
          ))
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {links.isPending
              ? 'Loading…'
              : 'Your gym hasn’t matched you with a trainer yet. Tell them what you need.'}
          </ThemedText>
        )}
        {pending ? (
          <View style={styles.pending}>
            <Pill label="Request sent" tone="warning" icon="time-outline" />
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {pending.trainerName ? `Asked for ${pending.trainerName}. ` : ''}The gym will get back
              to you.
            </ThemedText>
          </View>
        ) : null}
        <Button
          label={
            pending
              ? 'View your request'
              : trainers.length
                ? 'Ask for another trainer'
                : 'Ask for a trainer'
          }
          icon="hand-right-outline"
          variant="secondary"
          size="compact"
          onPress={() => router.push('/request-trainer')}
        />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
