import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * Shown while a gym has no membership plans: memberships can't be recorded
 * until there's a plan to sell, and only owners can create one.
 */
export function MembershipSetup({ isOwner }: { isOwner: boolean }) {
  return (
    <Card highlighted>
      <View style={styles.row}>
        <Icon name="card-outline" size={22} color="primary" />
        <ThemedText type="heading">Set up memberships</ThemedText>
      </View>
      {isOwner ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            1. Add a plan with its price and length, like Monthly ₹1,499 for 30 days.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            2. Record a payment for each member. Their membership starts straight away and shows on
            their Home screen.
          </ThemedText>
          <Button
            label="Add your first plan"
            icon="add"
            size="compact"
            onPress={() => router.push('/membership-plan-editor')}
          />
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          There are no membership plans yet. Ask the owner to add one, then you can record payments
          here.
        </ThemedText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
