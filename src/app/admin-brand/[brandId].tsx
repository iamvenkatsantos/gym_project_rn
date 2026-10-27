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
import { FeeEditor } from '@/features/branches/components/fee-editor';
import {
  useAdminBranches,
  useBillingSettings,
  useRenameBrand,
  useSetBrandFee,
} from '@/features/branches/hooks';
import { groupBrands, ownerNames } from '@/features/branches/rules';
import type { AdminBrand } from '@/features/branches/types';
import { formatAmount } from '@/lib/format';
import { validateTitle } from '@/lib/validation';

/** Admins only: one brand's branches, its name and fee, and adding a branch to it. */
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
  const setFee = useSetBrandFee(brand.brandId);
  const settings = useBillingSettings();
  const standard = settings.data
    ? formatAmount(settings.data.branchFeeCents, settings.data.currency)
    : '…';
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
            detail={[b.city, `${b.members} members`].filter(Boolean).join(' · ')}
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

      <SectionHeader
        title="Fee per branch"
        detail={brand.brandFeeCents === null ? `Standard (${standard})` : 'Own deal'}
      />
      <Card style={styles.rename}>
        <FeeEditor
          key={brand.brandFeeCents ?? 'standard'}
          label="This brand's monthly fee per branch (₹)"
          feeCents={brand.brandFeeCents}
          pending={setFee.isPending}
          error={setFee.error}
          onSave={(fee) => setFee.mutate(fee)}
        />
        {brand.brandFeeCents !== null ? (
          <Button
            label={`Use the standard fee (${standard})`}
            variant="secondary"
            size="compact"
            loading={setFee.isPending}
            onPress={() => setFee.mutate(null)}
          />
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Leave empty to bill this brand at the standard fee.
          </ThemedText>
        )}
      </Card>

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
