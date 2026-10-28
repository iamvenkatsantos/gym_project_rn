import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Pill } from '@/components/pill';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing, TapTarget } from '@/constants/theme';
import type { Role } from '@/features/auth/types';
import { roleTone } from '@/features/members/components/person-row';
import { useInvites, useWithdrawInvite } from '@/features/members/hooks';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/format';

/**
 * Invites still waiting for sign-up, as the database lets this person see them:
 * all of them for owners and supervisors, their own for trainers. Shows nothing
 * when there are none.
 */
export function PendingInvites({
  gymId,
  canWithdraw,
}: {
  gymId: string;
  canWithdraw: (role: Role) => boolean;
}) {
  const theme = useTheme();
  const invites = useInvites(gymId);
  const withdraw = useWithdrawInvite();

  if (!invites.data?.length) return null;
  return (
    <>
      <SectionHeader title="Pending invites" detail={`${invites.data.length}`} />
      <Card>
        {invites.data.map((invite, i) => (
          <View
            key={invite.id}
            style={[
              styles.invite,
              i > 0 && {
                borderTopColor: theme.border,
                borderTopWidth: StyleSheet.hairlineWidth,
              },
            ]}>
            <Icon name="mail-outline" size={20} />
            <View style={styles.flex}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {invite.email}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Invited {formatDate(invite.createdAt)} · waiting for sign-up
              </ThemedText>
            </View>
            <Pill label={invite.role} tone={roleTone[invite.role]} />
            {canWithdraw(invite.role) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Withdraw invite for ${invite.email}`}
                hitSlop={8}
                disabled={withdraw.isPending}
                onPress={() => withdraw.mutate(invite.id)}>
                <Icon name="close-circle" size={22} />
              </Pressable>
            ) : null}
          </View>
        ))}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: TapTarget + 8,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
});
