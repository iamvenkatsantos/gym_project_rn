import { Linking, Pressable, Share, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing, TapTarget } from '@/constants/theme';
import type { Role } from '@/features/auth/types';
import { whatsappUrl } from '@/features/enquiries/rules';
import { useInvites, useWithdrawInvite } from '@/features/members/hooks';
import { formatInviteCode, inviteMessage } from '@/features/members/rules';
import type { GymInvite } from '@/features/members/types';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/format';

/** Sends a WhatsApp invite's message again, with the same code. */
function resend(invite: GymInvite, gymName: string) {
  const message = inviteMessage(gymName, invite.email, invite.role, 'invited', invite.code);
  const opened = invite.phone
    ? Linking.openURL(whatsappUrl(invite.phone.replace(/^\+91/, ''), message))
    : Share.share({ message });
  opened.catch(() => {});
}

function inviteDetail(invite: GymInvite) {
  const role = invite.role[0].toUpperCase() + invite.role.slice(1);
  const expired = invite.codeExpiresAt && new Date(invite.codeExpiresAt) < new Date();
  if (invite.code && !expired) return `${role} · code ${formatInviteCode(invite.code)}`;
  if (invite.code) return `${role} · code expired, invite again`;
  return `${role} · invited ${formatDate(invite.createdAt)}`;
}

/**
 * People invited but not joined yet, as the database lets this person see them:
 * all of them for owners and supervisors, their own for trainers. They aren't
 * active, so they get no trainer until they join. Shows nothing when there are none.
 */
export function PendingInvites({
  gymId,
  gymName,
  canWithdraw,
}: {
  gymId: string;
  gymName: string;
  canWithdraw: (role: Role) => boolean;
}) {
  const theme = useTheme();
  const invites = useInvites(gymId);
  const withdraw = useWithdrawInvite();

  if (!invites.data?.length) return null;
  return (
    <>
      <SectionHeader title="Invited" detail={`${invites.data.length}`} />
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
            <Icon name={invite.code ? 'logo-whatsapp' : 'mail-outline'} size={20} />
            <View style={styles.flex}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {invite.email}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {inviteDetail(invite)}
              </ThemedText>
            </View>
            {invite.code ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Send ${invite.email} the invite on WhatsApp again`}
                hitSlop={8}
                onPress={() => resend(invite, gymName)}>
                <Icon name="share-social-outline" size={22} color="accent" />
              </Pressable>
            ) : null}
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
