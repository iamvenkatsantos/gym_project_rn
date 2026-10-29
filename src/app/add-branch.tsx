import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAddBranch, useBillingSettings } from '@/features/branches/hooks';
import { GymDetailsForm } from '@/features/gyms/components/gym-details-form';
import { emptyGymDetails } from '@/features/gyms/rules';
import { formatAmount } from '@/lib/format';
import { parseAmount, validateAmount } from '@/lib/validation';

/**
 * Admins only: a new branch for a brand. Its owners get it straight away, along with a copy of
 * the first branch's membership plans to reprice. Staff and members are invited per branch.
 * It starts at the default fee; change the amount here to give it a fee of its own, or no fee.
 */
export default function AddBranchScreen() {
  const { brandId, brandName } = useLocalSearchParams<{ brandId: string; brandName?: string }>();
  const add = useAddBranch(brandId);
  const settings = useBillingSettings();
  const defaultFee = settings.data?.branchFeeCents;
  // Empty until the default arrives; an untouched or emptied field means the default.
  const [feeText, setFeeText] = useState<string | null>(null);
  const shownFee = feeText ?? (defaultFee === undefined ? '' : String(defaultFee / 100));
  const feeError = shownFee.trim()
    ? validateAmount(shownFee, { label: 'fee', allowZero: true, max: 1_000_000 })
    : null;
  const [triedSubmit, setTriedSubmit] = useState(false);

  const feeToSave = () => {
    const parsed = shownFee.trim() ? parseAmount(shownFee) : null;
    return parsed === null || parsed === defaultFee ? null : parsed;
  };

  return (
    <Screen refreshable={false}>
      <View style={styles.intro}>
        <ThemedText type="heading">New {brandName ?? ''} branch</ThemedText>
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            This adds one branch to the bill. The brand&apos;s owners see it in their branch
            switcher; its members, trainers and supervisors only see this branch.
          </ThemedText>
        </Card>
      </View>

      <SectionHeader
        title="Yearly fee"
        detail={
          settings.data
            ? `Default ${formatAmount(settings.data.branchFeeCents, settings.data.currency)}`
            : undefined
        }
      />
      <TextField
        label="This branch's yearly fee (₹)"
        icon="cash-outline"
        value={shownFee}
        onChangeText={setFeeText}
        error={feeError}
        showError={triedSubmit}
        keyboardType="decimal-pad"
        returnKeyType="done"
      />
      {parseAmount(shownFee) === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No fee: the owner pays nothing until you set one.
        </ThemedText>
      ) : (
        <Button
          label="No fee for now"
          icon="gift-outline"
          variant="secondary"
          size="compact"
          onPress={() => setFeeText('0')}
        />
      )}

      <GymDetailsForm
        initial={{ ...emptyGymDetails, name: brandName ? `${brandName} ` : '' }}
        submitLabel="Add branch"
        pending={add.isPending}
        error={add.error}
        onSubmit={(details) => {
          setTriedSubmit(true);
          if (feeError) return;
          add.mutate({ details, feeCents: feeToSave() }, { onSuccess: () => router.back() });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: Spacing.three,
  },
});
