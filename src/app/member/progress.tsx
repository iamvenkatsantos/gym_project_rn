import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

// Placeholder until the fitness-core phase adds workout logs and body measurements.
export default function MemberProgressScreen() {
  return (
    <Screen>
      <Card>
        <Icon name="trending-up-outline" size={28} color="primary" />
        <ThemedText type="heading">Progress is on the way</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Soon you&apos;ll see your body weight, measurements, workout streaks and personal records
          here.
        </ThemedText>
      </Card>
    </Screen>
  );
}
