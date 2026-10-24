import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import {
  daysRemaining,
  membershipStatus,
  type MembershipStatus,
} from '@/features/memberships/rules';
import type { Membership } from '@/features/memberships/types';
import { formatDate } from '@/lib/format';

const statusLabel: Record<MembershipStatus, string> = {
  active: 'Active',
  expiringSoon: 'Expiring soon',
  expired: 'Expired',
  upcoming: 'Starts soon',
};

type MembershipCardProps = {
  membership: Membership;
  showMember?: boolean;
};

export function MembershipCard({ membership, showMember }: MembershipCardProps) {
  const status = membershipStatus(membership);

  return (
    <Card>
      <ThemedText type="smallBold">
        {showMember ? `${membership.memberName} · ` : ''}
        {membership.plan.name} plan
      </ThemedText>
      <ThemedText type="small" themeColor={status === 'active' ? 'textSecondary' : 'primary'}>
        {statusLabel[status]}
        {status === 'active' || status === 'expiringSoon'
          ? ` · ${daysRemaining(membership)} days left`
          : ''}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {formatDate(membership.startsOn)} to {formatDate(membership.endsOn)}
      </ThemedText>
    </Card>
  );
}
