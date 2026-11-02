import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * On a member's Plans tab once their trainer turns on self workouts: set up a week, or open it.
 * The plans themselves show under Today and This week with the trainer's plans.
 */
export function SelfWorkoutsCard({ hasPlans }: { hasPlans: boolean }) {
  if (!hasPlans) {
    return (
      <Card highlighted>
        <ThemedText type="label" themeColor="accent">
          Self workouts
        </ThemedText>
        <ThemedText type="heading">Plan your own workouts</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Answer 4 questions and get a week of plans.
        </ThemedText>
        <Button
          label="Set up my plan"
          icon="sparkles-outline"
          onPress={() => router.push('/self-plan-setup')}
        />
      </Card>
    );
  }
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.flex}>
          <ThemedText type="smallBold">My plan</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Edit days and exercises any time.
          </ThemedText>
        </View>
        <Button
          label="Open"
          icon="calendar-outline"
          variant="secondary"
          size="compact"
          onPress={() => router.push('/self-plan')}
        />
      </View>
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
