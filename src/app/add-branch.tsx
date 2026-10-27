import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAddBranch } from '@/features/branches/hooks';
import { GymDetailsForm } from '@/features/gyms/components/gym-details-form';
import { emptyGymDetails } from '@/features/gyms/rules';

/**
 * Admins only: a new branch for a brand. Its owners get it straight away, along with a copy of
 * the first branch's membership plans to reprice. Staff and members are invited per branch.
 */
export default function AddBranchScreen() {
  const { brandId, brandName } = useLocalSearchParams<{ brandId: string; brandName?: string }>();
  const add = useAddBranch(brandId);

  return (
    <Screen>
      <View style={styles.intro}>
        <ThemedText type="heading">New {brandName ?? ''} branch</ThemedText>
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            This adds one branch to the brand&apos;s bill. The brand&apos;s owners see it in their
            branch switcher; its members, trainers and supervisors only see this branch.
          </ThemedText>
        </Card>
      </View>
      <GymDetailsForm
        initial={{ ...emptyGymDetails, name: brandName ? `${brandName} ` : '' }}
        submitLabel="Add branch"
        pending={add.isPending}
        error={add.error}
        onSubmit={(details) => add.mutate(details, { onSuccess: () => router.back() })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: Spacing.three,
  },
});
