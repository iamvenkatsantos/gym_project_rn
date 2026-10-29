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
import { useInviteGymOwner } from '@/features/members/hooks';
import { parseMobile } from '@/features/members/import-rules';
import { formatInviteCode, inviteMessage, normalizeEmail } from '@/features/members/rules';
import type { InviteChannel, InviteOutcome } from '@/features/members/types';
import { validateEmail } from '@/lib/validation';

/** Opens a chat with their number, or the share sheet to pick who gets it. */
function sendOnWhatsApp(message: string, mobile: string | null) {
  const opened = mobile ? Linking.openURL(whatsappUrl(mobile, message)) : Share.share({ message });
  opened.catch(() => {});
}

function describe(
  { result, emailSent, emailError, code }: InviteOutcome,
  gymName: string,
  email: string,
) {
  if (result === 'added') {
    return {
      title: `${gymName} is ready`,
      detail: 'They already have an account. It shows next time they open the app.',
    };
  }
  if (code) {
    return {
      title: `Code ${formatInviteCode(code)}`,
      detail: `They join ${gymName} with this code. It works once, for 7 days.`,
    };
  }
  if (emailSent) {
    return {
      title: 'Invite sent',
      detail: `We emailed ${email} a code. They join once they enter it.`,
    };
  }
  return {
    title: `${gymName} is ready`,
    detail: emailError
      ? `Email failed: ${emailError.replace(/\.$/, '')}. Ask them to sign up with ${email}.`
      : `They join once they sign up with ${email}.`,
  };
}

/**
 * CoreFit Gym's admin sets up a new gym and invites its owner. The owner never creates a
 * gym; they only edit its details. Works with no gyms at all. The server checks it's the admin.
 */
export default function InviteOwnerScreen() {
  const invite = useInviteGymOwner();
  const [channel, setChannel] = useState<InviteChannel>('whatsapp');
  const [gymName, setGymName] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const nameError = gymName.trim().length < 2 ? "Enter the gym's name." : null;
  const emailError = validateEmail(email);
  const whatsappNumber = parseMobile(mobile);
  const mobileError =
    channel === 'whatsapp' && !whatsappNumber ? 'Enter a 10-digit mobile number.' : null;
  const sent = invite.variables;
  const result = invite.data && sent ? describe(invite.data, sent.gym.name, sent.email) : null;
  const message =
    invite.data && sent
      ? inviteMessage(sent.gym.name, sent.email, 'gym_owner', invite.data.result, invite.data.code)
      : null;

  const send = () => {
    const variables = {
      gym: { name: gymName.trim(), city: city.trim() },
      email: normalizeEmail(email),
      channel,
      phone: channel === 'whatsapp' ? whatsappNumber : null,
    };
    invite.mutate(variables, {
      onSuccess: (outcome) => {
        if (channel === 'whatsapp') {
          sendOnWhatsApp(
            inviteMessage(
              variables.gym.name,
              variables.email,
              'gym_owner',
              outcome.result,
              outcome.code,
            ),
            whatsappNumber,
          );
        }
      },
    });
  };
  // Once sent, the gym exists, so the form locks: a resend would set up a second gym.
  const locked = !!invite.data || invite.isPending;
  const edit = (set: (text: string) => void) => (text: string) => {
    set(text);
    invite.reset();
  };

  return (
    <Screen refreshable={false}>
      <ThemedText type="small" themeColor="textSecondary">
        You set up the gym. The owner edits its details later.
      </ThemedText>
      <TextField
        label="Gym name"
        placeholder="AMR Fitness"
        value={gymName}
        editable={!locked}
        onChangeText={edit(setGymName)}
        autoCapitalize="words"
        maxLength={80}
        error={gymName ? nameError : null}
      />
      <TextField
        label="City"
        placeholder="Optional"
        value={city}
        editable={!locked}
        onChangeText={edit(setCity)}
        autoCapitalize="words"
        maxLength={80}
      />
      <SegmentedControl<InviteChannel>
        options={[
          { value: 'whatsapp', label: 'WhatsApp' },
          { value: 'email', label: 'Email' },
        ]}
        value={channel}
        onChange={(next) => {
          if (locked) return;
          setChannel(next);
          invite.reset();
        }}
      />
      {channel === 'whatsapp' ? (
        <TextField
          label="Mobile"
          placeholder="98400 12345"
          value={mobile}
          editable={!locked}
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
        editable={!locked}
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
      {result && sent?.channel === 'whatsapp' && message ? (
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
                setGymName('');
                setCity('');
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
          disabled={!!nameError || !!emailError || !!mobileError}
          loading={invite.isPending}
          onPress={send}
        />
      ) : (
        <Button
          label="Send email invite"
          icon="mail-outline"
          disabled={!!nameError || !!emailError}
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
