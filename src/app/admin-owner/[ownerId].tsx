import { router, useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ListGroup, ListRow } from '@/components/list-row';
import { Pill } from '@/components/pill';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAdminBranches, useBillingSettings } from '@/features/branches/hooks';
import { branchBill, ownerAccounts } from '@/features/branches/rules';
import type { BillingSettings, OwnerAccount } from '@/features/branches/types';
import { formatAmount } from '@/lib/format';

/** Admins only: one owner's brands and branches, and what they pay each year. */
export default function AdminOwnerScreen() {
  const { ownerId } = useLocalSearchParams<{ ownerId: string }>();
  const branches = useAdminBranches();
  const settings = useBillingSettings();

  return (
    <Screen>
      <QueryState query={settings}>
        {(billing) => (
          <QueryState query={branches}>
            {(list) => {
              const account = ownerAccounts(list, billing).find((a) => a.owner.id === ownerId);
              if (!account) {
                return <ThemedText themeColor="textSecondary">Owner not found.</ThemedText>;
              }
              return <OwnerDetails account={account} billing={billing} />;
            }}
          </QueryState>
        )}
      </QueryState>
    </Screen>
  );
}

function OwnerDetails({ account, billing }: { account: OwnerAccount; billing: BillingSettings }) {
  const { owner } = account;

  return (
    <>
      <View style={styles.header}>
        <ThemedText type="title">{owner.fullName || owner.email}</ThemedText>
        {owner.email ? (
          <ThemedText type="small" themeColor="textSecondary">
            {owner.email}
          </ThemedText>
        ) : null}
      </View>
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          To collect each year
        </ThemedText>
        <ThemedText type="title" themeColor="accent">
          {formatAmount(account.yearlyCents, billing.currency)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {account.branches} branch{account.branches === 1 ? '' : 'es'} across{' '}
          {account.brands.length} brand{account.brands.length === 1 ? '' : 's'}
        </ThemedText>
      </Card>
      {owner.email ? (
        <Button
          label="Email owner"
          icon="mail-outline"
          variant="secondary"
          onPress={() => Linking.openURL(`mailto:${owner.email}`)}
        />
      ) : null}

      {account.brands.map((brand) => (
        <View key={brand.brandId} style={styles.brand}>
          <SectionHeader title={brand.brandName} />
          <ListGroup>
            {brand.branches.map((b, i) => (
              <ListRow
                key={b.gymId}
                divider={i > 0}
                icon="location-outline"
                label={b.gymName}
                detail={[
                  b.city,
                  `${b.members} members`,
                  `${formatAmount(branchBill(b, billing), billing.currency)}/year`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() =>
                  router.push({ pathname: '/admin-branch/[gymId]', params: { gymId: b.gymId } })
                }
              />
            ))}
            <ListRow
              divider
              icon="settings-outline"
              label="Brand settings"
              detail="Add a branch or rename the brand"
              trailing={<Pill label={`${brand.branches.length}`} />}
              onPress={() =>
                router.push({
                  pathname: '/admin-brand/[brandId]',
                  params: { brandId: brand.brandId },
                })
              }
            />
          </ListGroup>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  brand: {
    gap: Spacing.two,
  },
});
