import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Share, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing, TapTarget } from '@/constants/theme';
import type { Role } from '@/features/auth/types';
import { whatsappUrl } from '@/features/enquiries/rules';
import { useInvites, useResendInvite, useWithdrawInvite } from '@/features/members/hooks';
import { inviteMessage, inviteStatus, resendChannel, resendNotice } from '@/features/members/rules';
import type { GymInvite } from '@/features/members/types';
import { useTheme } from '@/hooks/use-theme';
import { loginLabel } from '@/lib/mobile-login';

/** Opens WhatsApp with the invite message and its join code, or the share sheet without a number. */
function sendOnWhatsApp(invite: GymInvite, gymName: string, code: string) {
  const message = inviteMessage(gymName, invite.email, invite.role, 'invited', code);
  const opened = invite.phone
    ? Linking.openURL(whatsappUrl(invite.phone.replace(/^\+91/, ''), message))
    : Share.share({ message });
  opened.catch(() => {});
}

/**
 * People invited but not joined yet, as the database lets this person see them:
 * all of them for owners and supervisors, their own for trainers. They aren't
 * active, so they get no trainer until they join. Each one can be sent again (email,
 * or its WhatsApp code, renewed once expired). Shows nothing when there are none.
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
  const resend = useResendInvite(gymId);
  // The last Resend's answer, shown under that invite.
  const [notice, setNotice] = useState<{ id: string; text: string; error: boolean } | null>(null);

  const resendInvite = (invite: GymInvite) => {
    const channel = resendChannel(invite);
    setNotice(null);
    resend.mutate(
      { invite, channel },
      {
        onSuccess: (outcome) => {
          if (channel === 'whatsapp' && outcome.result === 'invited' && outcome.code) {
            sendOnWhatsApp(invite, gymName, outcome.code);
          }
          const text = resendNotice(outcome, channel);
          if (text) {
            const failed =
              outcome.result === 'invited' && channel === 'email' && !outcome.emailSent;
            setNotice({ id: invite.id, text, error: failed });
          }
        },
        onError: (error) => setNotice({ id: invite.id, text: error.message, error: true }),
      },
    );
  };

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
            <Icon
              name={resendChannel(invite) === 'whatsapp' ? 'logo-whatsapp' : 'mail-outline'}
              size={20}
            />
            <View style={styles.flex}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {loginLabel(invite.email)}
              </ThemedText>
              <ThemedText
                type="small"
                themeColor={invite.emailError ? 'danger' : 'textSecondary'}
                numberOfLines={1}>
                {inviteStatus(invite)}
              </ThemedText>
              {notice?.id === invite.id ? (
                <ThemedText type="small" themeColor={notice.error ? 'danger' : 'accent'}>
                  {notice.text}
                </ThemedText>
              ) : null}
            </View>
            {resend.isPending && resend.variables?.invite.id === invite.id ? (
              <ActivityIndicator style={styles.icon} />
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  resendChannel(invite) === 'whatsapp'
                    ? `Send ${loginLabel(invite.email)} the invite on WhatsApp again`
                    : `Email ${loginLabel(invite.email)} the invite again`
                }
                hitSlop={8}
                disabled={resend.isPending}
                style={styles.icon}
                onPress={() => resendInvite(invite)}>
                <Icon
                  name={
                    resendChannel(invite) === 'whatsapp' ? 'share-social-outline' : 'send-outline'
                  }
                  size={22}
                  color="accent"
                />
              </Pressable>
            )}
            {canWithdraw(invite.role) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Withdraw invite for ${loginLabel(invite.email)}`}
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
  icon: {
    minWidth: 28,
    alignItems: 'center',
  },
});
