import { router } from 'expo-router';

import { ListGroup, ListRow } from '@/components/list-row';
import { useActiveGym } from '@/features/auth/use-profile';
import { useBranchAccess } from '@/features/subscription/hooks';
import { formatDate } from '@/lib/format';

/**
 * Top of every home screen, from the day after the plan ends (no advance warning).
 * The owner can tap it to pay; everyone sees the day the app stops.
 */
export function PlanBanner() {
  const gym = useActiveGym();
  const access = useBranchAccess(gym.gymId).data;
  if (!access || access.paid) return null;
  const stops = access.locksOn ? `App stops for everyone ${formatDate(access.locksOn)}` : null;

  if (gym.role === 'owner') {
    return (
      <ListGroup>
        <ListRow
          icon="ribbon-outline"
          tone="danger"
          label="CoreFit Gym plan not paid"
          detail={stops ? `Pay now · ${stops}` : 'Pay now'}
          onPress={() => router.push('/subscription')}
        />
      </ListGroup>
    );
  }
  return (
    <ListGroup>
      <ListRow
        icon="alert-circle-outline"
        tone="danger"
        label="Your gym's CoreFit Gym plan isn't paid"
        detail={stops ? `${stops} unless the owner renews` : 'Ask the owner to renew'}
      />
    </ListGroup>
  );
}
