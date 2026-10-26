import { router } from 'expo-router';

import { MembershipRow } from '@/features/memberships/components/membership-card';
import { useRemindRenewal } from '@/features/memberships/hooks';
import type { Membership } from '@/features/memberships/types';

/** A membership that's ending or has ended, with Renew and a push to remind the member. */
export function RenewalRow({ gymId, membership }: { gymId: string; membership: Membership }) {
  const remind = useRemindRenewal(gymId);
  const note = remind.isSuccess
    ? remind.data
      ? 'Reminder sent'
      : 'Already reminded today'
    : remind.error
      ? `Couldn't remind: ${remind.error.message}`
      : undefined;

  return (
    <MembershipRow
      membership={membership}
      onRenew={() =>
        router.push({ pathname: '/record-membership', params: { memberId: membership.memberId } })
      }
      // Once a day is enough; the server holds back repeats too.
      onRemind={remind.isSuccess ? undefined : () => remind.mutate(membership.memberId)}
      reminding={remind.isPending}
      note={note}
      noteTone={remind.error ? 'danger' : 'textSecondary'}
    />
  );
}
