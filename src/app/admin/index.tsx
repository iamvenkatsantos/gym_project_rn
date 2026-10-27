import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { ListGroup, ListRow } from '@/components/list-row';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { StatTile } from '@/components/stat-tile';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { FeeEditor } from '@/features/branches/components/fee-editor';
import { useAdminBranches, useBillingSettings, useSetBranchFee } from '@/features/branches/hooks';
import { monthlyTotal, ownerAccounts, unownedBranches } from '@/features/branches/rules';
import { formatAmount } from '@/lib/format';

/**
 * The admin's home: how many owners and branches there are and what to collect this month.
 * Each branch is billed at the default fee unless the admin gave it a fee of its own.
 */
export default function AdminOverviewScreen() {
  const branches = useAdminBranches();
  const settings = useBillingSettings();
  const setFee = useSetBranchFee();

  return (
    <Screen>
      <QueryState query={settings}>
        {(billing) => (
          <QueryState query={branches}>
            {(list) => {
              const owners = ownerAccounts(list, billing);
              const orphans = unownedBranches(list);
              return (
                <>
                  <Card>
                    <ThemedText type="small" themeColor="textSecondary">
                      To collect each month
                    </ThemedText>
                    <ThemedText type="title" themeColor="accent">
                      {formatAmount(monthlyTotal(list, billing), billing.currency)}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {list.length} branches at{' '}
                      {formatAmount(billing.branchFeeCents, billing.currency)} each, unless a branch
                      has its own fee, plus{' '}
                      {formatAmount(billing.onlineAddonCents, billing.currency)} for each with
                      online payments.
                    </ThemedText>
                  </Card>
                  <View style={styles.grid}>
                    <StatTile
                      label="Owners"
                      value={owners.length}
                      icon="people"
                      accent
                      onPress={() => router.push('/admin/owners')}
                    />
                    <StatTile
                      label="Branches"
                      value={list.length}
                      icon="business-outline"
                      onPress={() => router.push('/admin/owners')}
                    />
                  </View>

                  {orphans.length ? (
                    <>
                      <SectionHeader title="Branches without an owner" />
                      <ListGroup>
                        {orphans.map((b, i) => (
                          <ListRow
                            key={b.gymId}
                            divider={i > 0}
                            icon="alert-circle-outline"
                            tone="danger"
                            label={b.gymName}
                            detail={b.city || undefined}
                            onPress={() =>
                              router.push({
                                pathname: '/admin-branch/[gymId]',
                                params: { gymId: b.gymId },
                              })
                            }
                          />
                        ))}
                      </ListGroup>
                    </>
                  ) : null}

                  <SectionHeader title="Default fee" detail="Per branch, per month" />
                  <Card>
                    <FeeEditor
                      key={billing.branchFeeCents}
                      label="Default monthly fee per branch (₹)"
                      feeCents={billing.branchFeeCents}
                      pending={setFee.isPending}
                      error={setFee.error}
                      onSave={(fee) => setFee.mutate(fee)}
                    />
                  </Card>
                </>
              );
            }}
          </QueryState>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
});
