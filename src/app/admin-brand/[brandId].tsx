import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ListGroup, ListRow } from '@/components/list-row';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAdminBranches, useBillingSettings, useRenameBrand } from '@/features/branches/hooks';
import { branchBill, groupBrands, ownerNames } from '@/features/branches/rules';
import type { AdminBrand } from '@/features/branches/types';
import { formatAmount } from '@/lib/format';
import { validateTitle } from '@/lib/validation';

/** Admins only: one brand's branches and name, and adding a branch to it. */
export default function AdminBrandScreen() {
  const { brandId } = useLocalSearchParams<{ brandId: string }>();
  const branches = useAdminBranches();

  return (
    <Screen>
      <QueryState query={branches}>
        {(list) => {
          const brand = groupBrands(list).find((b) => b.brandId === brandId);
          if (!brand) return <ThemedText themeColor="textSecondary">Brand not found.</ThemedText>;
          return <BrandDetails brand={brand} />;
        }}
      </QueryState>
    </Screen>
  );
}

function BrandDetails({ brand }: { brand: AdminBrand }) {
  const rename = useRenameBrand(brand.brandId);
  const settings = useBillingSettings();
  const [name, setName] = useState(brand.brandName);
  const error = validateTitle(name, { label: 'brand name', max: 80 });
  const changed = name.trim() !== brand.brandName;

  return (
    <>
      <ThemedText type="title">{brand.brandName}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Owners: {ownerNames(brand.owners)}
      </ThemedText>

      <SectionHeader title="Branches" detail={`${brand.branches.length} billed`} />
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
              settings.data &&
                `${formatAmount(branchBill(b, settings.data), settings.data.currency)}/month`,
            ]
              .filter(Boolean)
              .join(' · ')}
            onPress={() =>
              router.push({ pathname: '/admin-branch/[gymId]', params: { gymId: b.gymId } })
            }
          />
        ))}
      </ListGroup>
      <Button
        label="Add a branch"
        icon="add-circle-outline"
        onPress={() =>
          router.push({
            pathname: '/add-branch',
            params: { brandId: brand.brandId, brandName: brand.brandName },
          })
        }
      />

      <SectionHeader title="Brand name" />
      <Card style={styles.rename}>
        <TextField
          label="Brand name"
          value={name}
          onChangeText={setName}
          error={error}
          autoCapitalize="words"
          returnKeyType="done"
        />
        <View>
          <Button
            label="Save name"
            variant="secondary"
            size="compact"
            disabled={!changed || !!error}
            loading={rename.isPending}
            onPress={() => rename.mutate(name)}
          />
        </View>
        {rename.error ? <ThemedText themeColor="danger">{rename.error.message}</ThemedText> : null}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  rename: {
    gap: Spacing.three,
  },
});
