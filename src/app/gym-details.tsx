import { router } from 'expo-router';

import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { useActiveGym } from '@/features/auth/use-profile';
import { GymDetailsForm } from '@/features/gyms/components/gym-details-form';
import { useGymDetails, useUpdateGymDetails } from '@/features/gyms/hooks';

/** Owners keep the gym's name and front-desk contact up to date. */
export default function GymDetailsScreen() {
  const gym = useActiveGym();
  const details = useGymDetails(gym.gymId);
  const update = useUpdateGymDetails(gym.gymId);

  return (
    <Screen>
      <QueryState query={details}>
        {(initial) => (
          <GymDetailsForm
            initial={initial}
            submitLabel="Save changes"
            pending={update.isPending}
            error={update.error}
            onSubmit={(next) => update.mutate(next, { onSuccess: () => router.back() })}
          />
        )}
      </QueryState>
    </Screen>
  );
}
