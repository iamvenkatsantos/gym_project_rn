import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ListGroup, ListRow } from '@/components/list-row';
import { Pill } from '@/components/pill';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { StatTile } from '@/components/stat-tile';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAdminBranches } from '@/features/branches/hooks';
import { branchCountsByOwner, groupBrands, ownerNames } from '@/features/branches/rules';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 'es'}`;

/**
 * CoreFit Gym's own admin: every brand and its branches, and how many branches each owner has
 * for billing. Only admins add branches; owners can't. The server checks this again.
 */
export default function AdminScreen() {
  const branches = useAdminBranches();

  return (
    <Screen eyebrow="CoreFit Gym admin" title="Brands and branches">
      <QueryState query={branches} isEmpty={(list) => list.length === 0} emptyText="No gyms yet.">
        {(list) => {
          const brands = groupBrands(list);
          const owners = branchCountsByOwner(list);
          return (
            <>
              <View style={styles.grid}>
                <StatTile label="Billable branches" value={list.length} icon="business" accent />
                <StatTile label="Brands" value={brands.length} icon="pricetags-outline" />
              </View>

              <SectionHeader title="Brands" detail="Tap to add a branch" />
              <ListGroup>
                {brands.map((brand, i) => (
                  <ListRow
                    key={brand.brandId}
                    divider={i > 0}
                    icon="business-outline"
                    label={brand.brandName}
                    detail={ownerNames(brand.owners)}
                    trailing={
                      <Pill label={plural(brand.branches.length, 'branch')} tone="accent" />
                    }
                    onPress={() =>
                      router.push({
                        pathname: '/admin-brand/[brandId]',
                        params: { brandId: brand.brandId },
                      })
                    }
                  />
                ))}
              </ListGroup>

              <SectionHeader title="Branches per owner" detail="For billing" />
              {owners.length ? (
                <ListGroup>
                  {owners.map((count, i) => (
                    <ListRow
                      key={count.owner.id}
                      divider={i > 0}
                      icon="person-outline"
                      label={count.owner.fullName || count.owner.email}
                      detail={[count.owner.email, count.brands.join(', ')]
                        .filter(Boolean)
                        .join(' · ')}
                      trailing={<Pill label={plural(count.branches, 'branch')} />}
                    />
                  ))}
                </ListGroup>
              ) : (
                <ThemedText themeColor="textSecondary">No owners yet.</ThemedText>
              )}
              <ThemedText type="small" themeColor="textSecondary">
                A new gym owner sets up their first branch from your invite (Invite → Owner → A new
                gym). After that, add their other branches here.
              </ThemedText>
            </>
          );
        }}
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
