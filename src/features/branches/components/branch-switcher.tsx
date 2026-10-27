import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/chip';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/auth-store';
import type { GymRole } from '@/features/auth/types';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { branchLabel, ownedBranches } from '@/features/branches/rules';

/**
 * For owners of more than one branch: which branch the app is showing, a tap to switch, and
 * "All branches" for the brand side by side. Everything else in the app stays one branch at a
 * time, so supervisors and trainers only ever see their own.
 */
export function BranchSwitcher() {
  const profile = useProfile();
  const active = useActiveGym();
  const setActiveGym = useAuthStore((s) => s.setActiveGym);
  const branches = ownedBranches(profile.gyms, active);
  if (branches.length < 2) return null;

  const select = (g: GymRole) => {
    if (g.gymId !== active.gymId) setActiveGym(g.gymId);
  };

  return (
    <View style={styles.root}>
      <ThemedText type="small" themeColor="textSecondary">
        {active.brandName} · {branches.length} branches
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {branches.map((g) => (
          <Chip
            key={g.gymId}
            label={branchLabel(g.gymName, g.brandName)}
            selected={g.gymId === active.gymId}
            onPress={() => select(g)}
          />
        ))}
        <Chip label="All branches" selected={false} onPress={() => router.push('/branches')} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.two,
  },
  row: {
    gap: Spacing.two,
  },
});
