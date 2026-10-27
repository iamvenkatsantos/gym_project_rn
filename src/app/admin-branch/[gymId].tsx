import { useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { ListGroup, ListRow } from '@/components/list-row';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { StatTile } from '@/components/stat-tile';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { Button } from '@/components/button';
import { FeeEditor } from '@/features/branches/components/fee-editor';
import { OnlinePaymentsEditor } from '@/features/branches/components/online-payments-editor';
import { useAdminBranches, useBillingSettings, useSetGymFee } from '@/features/branches/hooks';
import { branchBill, branchFee, ownerNames } from '@/features/branches/rules';
import type { AdminBranch, BillingSettings } from '@/features/branches/types';
import { formatDate, formatAmount } from '@/lib/format';

/** Admins only: one branch's address, contact, size and fee, for a visit or a billing call. */
export default function AdminBranchScreen() {
  const { gymId } = useLocalSearchParams<{ gymId: string }>();
  const branches = useAdminBranches();
  const settings = useBillingSettings();

  return (
    <Screen>
      <QueryState query={settings}>
        {(billing) => (
          <QueryState query={branches}>
            {(list) => {
              const b = list.find((x) => x.gymId === gymId);
              if (!b) return <ThemedText themeColor="textSecondary">Branch not found.</ThemedText>;
              const address = [b.address, b.city].filter(Boolean).join(', ');
              return (
                <>
                  <View style={styles.header}>
                    <ThemedText type="label" themeColor="accent">
                      {b.brandName}
                    </ThemedText>
                    <ThemedText type="title">{b.gymName}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Owner: {ownerNames(b.owners)} · Since {formatDate(b.createdAt.slice(0, 10))}
                    </ThemedText>
                  </View>
                  <View style={styles.grid}>
                    <StatTile label="Members" value={b.members} icon="people" accent compact />
                    <StatTile label="Staff" value={b.staff} icon="barbell-outline" compact />
                    <StatTile
                      label="Bill / month"
                      value={formatAmount(branchBill(b, billing), billing.currency)}
                      icon="cash-outline"
                      compact
                    />
                  </View>

                  <SectionHeader
                    title="Monthly fee"
                    detail={b.feeCents === null ? 'Default fee' : 'Own fee'}
                  />
                  <BranchFee branch={b} billing={billing} />

                  <SectionHeader title="Online payments" detail="Add-on" />
                  <OnlinePaymentsEditor
                    key={`${b.onlinePayments}-${b.razorpayAccountId}`}
                    branch={b}
                    billing={billing}
                  />

                  <SectionHeader title="Visit and contact" />
                  {address || b.phone || b.email ? (
                    <ListGroup>
                      {address ? (
                        <ListRow
                          icon="map-outline"
                          label="Address"
                          detail={address}
                          onPress={() =>
                            Linking.openURL(
                              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.gymName}, ${address}`)}`,
                            )
                          }
                        />
                      ) : null}
                      {b.phone ? (
                        <ListRow
                          divider={!!address}
                          icon="call-outline"
                          label="Front desk"
                          detail={b.phone}
                          onPress={() => Linking.openURL(`tel:${b.phone}`)}
                        />
                      ) : null}
                      {b.email ? (
                        <ListRow
                          divider={!!address || !!b.phone}
                          icon="mail-outline"
                          label="Email"
                          detail={b.email}
                          onPress={() => Linking.openURL(`mailto:${b.email}`)}
                        />
                      ) : null}
                    </ListGroup>
                  ) : (
                    <Card>
                      <ThemedText type="small" themeColor="textSecondary">
                        The owner hasn&apos;t added an address or contact yet. They can from
                        Dashboard → Gym details.
                      </ThemedText>
                    </Card>
                  )}
                </>
              );
            }}
          </QueryState>
        )}
      </QueryState>
    </Screen>
  );
}

/** The branch's fee: raise or lower it for this branch alone, or put it back on the default. */
function BranchFee({ branch, billing }: { branch: AdminBranch; billing: BillingSettings }) {
  const setFee = useSetGymFee(branch.gymId);
  const fallback = formatAmount(billing.branchFeeCents, billing.currency);

  return (
    <Card style={styles.fee}>
      <FeeEditor
        key={branch.feeCents ?? 'default'}
        label="This branch's monthly fee (₹)"
        feeCents={branchFee(branch, billing)}
        pending={setFee.isPending}
        error={setFee.error}
        onSave={(fee) => setFee.mutate(fee)}
      />
      {branch.feeCents === null ? (
        <ThemedText type="small" themeColor="textSecondary">
          On the default fee ({fallback}). Saving a different amount gives this branch its own fee.
        </ThemedText>
      ) : (
        <Button
          label={`Use the default fee (${fallback})`}
          variant="secondary"
          size="compact"
          loading={setFee.isPending}
          onPress={() => setFee.mutate(null)}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  fee: {
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.one,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
});
