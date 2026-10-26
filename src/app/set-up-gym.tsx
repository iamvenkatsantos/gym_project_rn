import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, withAlpha } from '@/constants/theme';
import { GymDetailsForm } from '@/features/gyms/components/gym-details-form';
import { useCreateGym } from '@/features/gyms/hooks';
import { emptyGymDetails } from '@/features/gyms/rules';
import { useTheme } from '@/hooks/use-theme';

/** A new owner's first step: their gym gets its own members, trainers and payments. */
export default function SetUpGymScreen() {
  const theme = useTheme();
  const create = useCreateGym();

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={[styles.badge, { backgroundColor: withAlpha(theme.primary, 0.16) }]}>
          <Icon name="business" size={28} color="accent" />
        </View>
        <ThemedText type="heading">Tell us about your gym</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          You&apos;ll be its owner. It starts empty: only the members, trainers and supervisors you
          invite can see it, and you only see them. You can change these details later.
        </ThemedText>
      </View>
      <GymDetailsForm
        initial={emptyGymDetails}
        submitLabel="Create my gym"
        pending={create.isPending}
        error={create.error}
        onSubmit={(details) => create.mutate(details, { onSuccess: () => router.replace('/') })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
});
