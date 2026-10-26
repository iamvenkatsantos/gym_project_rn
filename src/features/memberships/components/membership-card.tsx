import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Pill, type PillTone } from '@/components/pill';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  daysRemaining,
  membershipStatus,
  remainingFraction,
  type MembershipStatus,
} from '@/features/memberships/rules';
import type { Membership } from '@/features/memberships/types';
import { formatDate } from '@/lib/format';

const statusPill: Record<MembershipStatus, { label: string; tone: PillTone }> = {
  active: { label: 'Active', tone: 'success' },
  expiringSoon: { label: 'Expiring soon', tone: 'warning' },
  expired: { label: 'Expired', tone: 'danger' },
  upcoming: { label: 'Starts soon', tone: 'accent' },
};

/** Hero card for a member's own membership: days left front and centre. */
export function MembershipCard({ membership }: { membership: Membership }) {
  const status = membershipStatus(membership);
  const left = daysRemaining(membership);
  const pill = statusPill[status];

  return (
    <Card>
      <View style={styles.header}>
        <ThemedText type="heading">{membership.plan.name} plan</ThemedText>
        <Pill label={pill.label} tone={pill.tone} />
      </View>
      <View style={styles.days}>
        <ThemedText type="display" themeColor={status === 'active' ? 'accent' : 'text'}>
          {left}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {left === 1 ? 'day left' : 'days left'}
        </ThemedText>
      </View>
      <ProgressBar
        value={remainingFraction(membership)}
        color={status === 'expiringSoon' ? 'warning' : status === 'expired' ? 'danger' : 'primary'}
      />
      <ThemedText type="small" themeColor="textSecondary">
        {formatDate(membership.startsOn)} – {formatDate(membership.endsOn)}
      </ThemedText>
    </Card>
  );
}

/** Compact row for staff lists of members. */
export function MembershipRow({
  membership,
  onRenew,
}: {
  membership: Membership;
  onRenew?: () => void;
}) {
  const status = membershipStatus(membership);
  const pill = statusPill[status];

  return (
    <Card style={styles.row}>
      <View style={styles.rowBody}>
        <ThemedText type="smallBold">{membership.memberName}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {membership.plan.name} · ends {formatDate(membership.endsOn)}
        </ThemedText>
        <View style={styles.pill}>
          <Pill label={pill.label} tone={pill.tone} />
        </View>
      </View>
      {onRenew ? (
        <Button label="Renew" icon="refresh-outline" size="compact" onPress={onRenew} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  days: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowBody: {
    flex: 1,
    gap: Spacing.one,
  },
  pill: {
    flexDirection: 'row',
  },
});
