import { router } from 'expo-router';

import { ListGroup, ListRow } from '@/components/list-row';
import { useActiveGym } from '@/features/auth/use-profile';
import { subscriptionLine } from '@/features/subscription/components/subscription-card';
import { useBranchAccess, useSubscription } from '@/features/subscription/hooks';
import { canPay } from '@/features/subscription/rules';
import { formatDate } from '@/lib/format';

/**
 * Top of every home screen. The owner sees it while the plan is due, with a way to pay;
 * everyone else from the first unpaid day, with the day the app stops.
 */
export function PlanBanner() {
  const gym = useActiveGym();
  const isOwner = gym.role === 'owner';
  const access = useBranchAccess(gym.gymId).data;
  const sub = useSubscription(gym.gymId, { enabled: isOwner }).data;
  const stops = access?.locksOn ? `App stops for everyone ${formatDate(access.locksOn)}` : null;

  if (isOwner) {
    if (!sub || !canPay(sub)) return null;
    return (
      <ListGroup>
        <ListRow
          icon="ribbon-outline"
          tone="danger"
          label="Pay for CoreFit Gym"
          detail={access && !access.paid && stops ? `Not paid · ${stops}` : subscriptionLine(sub)}
          onPress={() => router.push('/subscription')}
        />
      </ListGroup>
    );
  }
  if (!access || access.paid) return null;
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
