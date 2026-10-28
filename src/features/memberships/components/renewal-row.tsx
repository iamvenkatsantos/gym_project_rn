import { router } from 'expo-router';
import { Linking } from 'react-native';

import { whatsappUrl } from '@/features/enquiries/rules';
import { MembershipRow } from '@/features/memberships/components/membership-card';
import { useRemindRenewal } from '@/features/memberships/hooks';
import { renewalMessage } from '@/features/memberships/rules';
import type { Membership } from '@/features/memberships/types';

/**
 * A membership that's ending or has ended, with Renew, a push to remind the member and, when
 * we have their mobile number, a WhatsApp message staff send themselves.
 */
export function RenewalRow({
  gymId,
  gymName,
  membership,
  phone,
}: {
  gymId: string;
  gymName: string;
  membership: Membership;
  phone?: string | null;
}) {
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
      onWhatsApp={
        phone
          ? () =>
              Linking.openURL(whatsappUrl(phone, renewalMessage(membership, gymName))).catch(
                () => {},
              )
          : undefined
      }
      reminding={remind.isPending}
      note={note}
      noteTone={remind.error ? 'danger' : 'textSecondary'}
    />
  );
}
