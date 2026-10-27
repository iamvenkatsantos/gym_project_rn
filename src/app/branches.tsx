import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { StatTile } from '@/components/stat-tile';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/auth-store';
import { useActiveGym } from '@/features/auth/use-profile';
import { useBrandOverview } from '@/features/branches/hooks';
import { branchLabel, totalStats } from '@/features/branches/rules';
import type { BranchStats } from '@/features/branches/types';
import { formatPrice } from '@/lib/format';

/** The owner's whole brand at once: totals, then each branch side by side. Tap one to open it. */
export default function BranchesScreen() {
  const gym = useActiveGym();
  const setActiveGym = useAuthStore((s) => s.setActiveGym);
  const overview = useBrandOverview(gym.brandId);

  const open = (branch: BranchStats) => {
    setActiveGym(branch.gymId);
    router.dismissTo('/');
  };

  return (
    <Screen eyebrow="All branches" title={gym.brandName ?? gym.gymName}>
      <QueryState query={overview} isEmpty={(list) => list.length === 0}>
        {(branches) => {
          const total = totalStats(branches);
          return (
            <>
              <View style={styles.grid}>
                <StatTile
                  label="Active members"
                  value={total.activeMembers}
                  icon="people"
                  accent
                  compact
                />
                <StatTile
                  label="Came today"
                  value={total.checkInsToday}
                  icon="log-in-outline"
                  compact
                />
                <StatTile
                  label="Renewals due"
                  value={total.renewalsDue}
                  icon="alert-circle-outline"
                  compact
                />
              </View>
              <Card>
                <ThemedText type="small" themeColor="textSecondary">
                  Taken this month, all branches
                </ThemedText>
                <ThemedText type="title" themeColor="accent">
                  {total.revenueThisMonthCents === null
                    ? 'Mixed currencies'
                    : formatPrice(total.revenueThisMonthCents, total.currency)}
                </ThemedText>
              </Card>

              <SectionHeader title="Branches" detail={`${branches.length}`} />
              {branches.map((b) => (
                <Pressable
                  key={b.gymId}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${b.gymName}`}
                  onPress={() => open(b)}>
                  <Card highlighted={b.gymId === gym.gymId} style={styles.branch}>
                    <View style={styles.branchHeader}>
                      <View style={styles.flex}>
                        <ThemedText type="smallBold">
                          {branchLabel(b.gymName, gym.brandName)}
                        </ThemedText>
                        {b.city ? (
                          <ThemedText type="small" themeColor="textSecondary">
                            {b.city}
                          </ThemedText>
                        ) : null}
                      </View>
                      <Icon name="chevron-forward" size={18} />
                    </View>
                    <View style={styles.numbers}>
                      <Figure label="Active" value={`${b.activeMembers}/${b.members}`} />
                      <Figure label="Today" value={b.checkInsToday} />
                      <Figure label="Renewals" value={b.renewalsDue} />
                      <Figure
                        label="This month"
                        value={formatPrice(b.revenueThisMonthCents, b.currency)}
                      />
                    </View>
                  </Card>
                </Pressable>
              ))}
              <ThemedText type="small" themeColor="textSecondary">
                Each branch keeps its own members, staff and payments. To add a branch, contact
                CoreFit Gym.
              </ThemedText>
            </>
          );
        }}
      </QueryState>
    </Screen>
  );
}

function Figure({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.number}>
      <ThemedText type="smallBold">{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  branch: {
    gap: Spacing.three,
  },
  branchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex: {
    flex: 1,
    gap: Spacing.half,
  },
  numbers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.two,
  },
  number: {
    minWidth: '25%',
    flexGrow: 1,
  },
});
