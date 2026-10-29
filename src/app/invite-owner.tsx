import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { whatsappUrl } from '@/features/enquiries/rules';
import { useInvitePerson } from '@/features/members/hooks';
import { parseMobile } from '@/features/members/import-rules';
import { inviteMessage, normalizeEmail } from '@/features/members/rules';
import type { InviteChannel, InviteOutcome } from '@/features/members/types';
import { validateEmail } from '@/lib/validation';

/** Opens a chat with their number, or the share sheet to pick who gets it. */
function sendOnWhatsApp(message: string, mobile: string | null) {
  const opened = mobile ? Linking.openURL(whatsappUrl(mobile, message)) : Share.share({ message });
  opened.catch(() => {});
}

function describe(
  { result, emailSent, emailError }: InviteOutcome,
  email: string,
  channel: InviteChannel,
) {
  if (result === 'added') {
    return { title: 'Ready to set up their gym', detail: 'They already have an account.' };
  }
  if (channel === 'whatsapp' || emailSent) {
    return {
      title: channel === 'whatsapp' ? 'Invite saved' : 'Invite sent',
      detail: `They set up their gym once they sign up with ${email}.`,
    };
  }
  return {
    title: 'Invite saved',
    detail: `Email failed${emailError ? `: ${emailError.replace(/\.$/, '')}` : ''}. Ask them to sign up with ${email}.`,
  };
}

/**
 * CoreFit Gym's admin invites someone to open a new gym of their own. It needs no gym,
 * so it works on a fresh install with no gyms at all. The server checks it's the admin.
 */
export default function InviteOwnerScreen() {
  // A new gym owner joins no existing gym, so there's no gym id to send.
  const invite = useInvitePerson('');
  const [channel, setChannel] = useState<InviteChannel>('whatsapp');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const emailError = validateEmail(email);
  const whatsappNumber = parseMobile(mobile);
  const mobileError =
    channel === 'whatsapp' && !whatsappNumber ? 'Enter a 10-digit mobile number.' : null;
  const result = invite.data
    ? describe(invite.data, invite.variables.email, invite.variables.channel)
    : null;
  const message = invite.data
    ? inviteMessage('', invite.variables.email, 'gym_owner', invite.data.result)
    : null;

  const send = () => {
    const variables = {
      email: normalizeEmail(email),
      role: 'gym_owner' as const,
      channel,
      phone: channel === 'whatsapp' ? whatsappNumber : null,
    };
    invite.mutate(variables, {
      onSuccess: (outcome) => {
        if (channel === 'whatsapp') {
          sendOnWhatsApp(
            inviteMessage('', variables.email, 'gym_owner', outcome.result),
            whatsappNumber,
          );
        }
      },
    });
  };
  const edit = (set: (text: string) => void) => (text: string) => {
    set(text);
    invite.reset();
  };

  return (
    <Screen refreshable={false}>
      <ThemedText type="small" themeColor="textSecondary">
        They get a new, empty gym of their own.
      </ThemedText>
      <SegmentedControl<InviteChannel>
        options={[
          { value: 'whatsapp', label: 'WhatsApp' },
          { value: 'email', label: 'Email' },
        ]}
        value={channel}
        onChange={(next) => {
          setChannel(next);
          invite.reset();
        }}
      />
      {channel === 'whatsapp' ? (
        <TextField
          label="Mobile"
          placeholder="98400 12345"
          value={mobile}
          onChangeText={edit(setMobile)}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          maxLength={16}
          error={mobile ? mobileError : null}
        />
      ) : null}
      <TextField
        label={channel === 'whatsapp' ? 'Email they sign up with' : 'Email'}
        placeholder="name@example.com"
        value={email}
        onChangeText={edit(setEmail)}
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        maxLength={254}
        error={email ? emailError : null}
      />

      {result ? (
        <Card highlighted>
          <View style={styles.result}>
            <Icon name="checkmark-circle" size={22} color="accent" />
            <ThemedText type="heading">{result.title}</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {result.detail}
          </ThemedText>
        </Card>
      ) : null}
      {invite.error ? <ThemedText themeColor="danger">{invite.error.message}</ThemedText> : null}
      {result && invite.variables?.channel === 'whatsapp' && message ? (
        <Button
          label="Send on WhatsApp again"
          icon="logo-whatsapp"
          variant="secondary"
          onPress={() => sendOnWhatsApp(message, whatsappNumber)}
        />
      ) : null}

      {result ? (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button
              label="Invite another"
              variant="secondary"
              onPress={() => {
                setEmail('');
                setMobile('');
                invite.reset();
              }}
            />
          </View>
          <View style={styles.flex}>
            <Button label="Done" onPress={() => router.back()} />
          </View>
        </View>
      ) : channel === 'whatsapp' ? (
        <Button
          label="Send on WhatsApp"
          icon="logo-whatsapp"
          disabled={!!emailError || !!mobileError}
          loading={invite.isPending}
          onPress={send}
        />
      ) : (
        <Button
          label="Send email invite"
          icon="mail-outline"
          disabled={!!emailError}
          loading={invite.isPending}
          onPress={send}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
