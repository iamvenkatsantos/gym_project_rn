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
import { useAdminBranches, useBillingSettings } from '@/features/branches/hooks';
import { branchFee, ownerNames } from '@/features/branches/rules';
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
                      label="Fee / month"
                      value={formatAmount(branchFee(b, billing), billing.currency)}
                      icon="cash-outline"
                      compact
                    />
                  </View>

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

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
});
