import { router } from 'expo-router';

import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { GymDetailsForm } from '@/features/gyms/components/gym-details-form';
import { useCreateGym } from '@/features/gyms/hooks';
import { emptyGymDetails } from '@/features/gyms/rules';

/** A new owner's first step: their gym gets its own members, trainers and payments. */
export default function SetUpGymScreen() {
  const create = useCreateGym();

  return (
    <Screen>
      <Card>
        <ThemedText type="heading">Tell us about your gym</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          You&apos;ll be its owner. It starts empty: only the members, trainers and supervisors you
          invite can see it, and you only see them.
        </ThemedText>
      </Card>
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
