import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Role } from '@/features/auth/types';
import { useActiveGym } from '@/features/auth/use-profile';
import { useInvitePerson } from '@/features/members/hooks';
import { isValidEmail, normalizeEmail } from '@/features/members/rules';
import type { InviteOutcome } from '@/features/members/types';

function describe({ result, emailSent, emailError }: InviteOutcome, email: string) {
  switch (result) {
    case 'added':
      return {
        title: 'Added to the gym',
        detail:
          'They already had a CoreFit account, so they can use this gym the next time they open the app.',
      };
    case 'already_member':
      return {
        title: 'Already at this gym',
        detail: 'Find them under People to change their role or reactivate them.',
      };
    case 'invited':
      return emailSent
        ? {
            title: 'Invite sent',
            detail: `We emailed ${email} a link. It opens CoreFit to set a password, then signs them in to this gym.`,
          }
        : {
            title: 'Invite saved',
            detail: `${emailError ? `We couldn't email them: ${emailError.replace(/\.?$/, '.')}` : "We couldn't email them."} Ask them to install CoreFit and create an account with this email. They join the gym as soon as they confirm it.`,
          };
  }
}

export default function InvitePersonScreen() {
  const gym = useActiveGym();
  const invite = useInvitePerson(gym.gymId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');
  const valid = isValidEmail(email);
  const result = invite.data ? describe(invite.data, invite.variables.email) : null;

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        Add a member, trainer or co-owner to {gym.gymName} by their email address.
      </ThemedText>
      <TextField
        label="Email"
        placeholder="name@example.com"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          invite.reset();
        }}
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary">
          Role
        </ThemedText>
        <SegmentedControl<Role>
          options={[
            { value: 'member', label: 'Member' },
            { value: 'trainer', label: 'Trainer' },
            { value: 'owner', label: 'Owner' },
          ]}
          value={role}
          onChange={(next) => {
            setRole(next);
            invite.reset();
          }}
        />
        {role === 'owner' ? (
          <ThemedText type="small" themeColor="warning">
            Owners can manage everyone at this gym, including you.
          </ThemedText>
        ) : null}
      </View>

      {result ? (
        <Card highlighted>
          <View style={styles.result}>
            <Icon name="checkmark-circle" size={22} color="primary" />
            <ThemedText type="heading">{result.title}</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {result.detail}
          </ThemedText>
        </Card>
      ) : null}
      {invite.error ? <ThemedText themeColor="danger">{invite.error.message}</ThemedText> : null}

      {result ? (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button
              label="Invite another"
              variant="secondary"
              onPress={() => {
                setEmail('');
                invite.reset();
              }}
            />
          </View>
          <View style={styles.flex}>
            <Button label="Done" onPress={() => router.back()} />
          </View>
        </View>
      ) : (
        <Button
          label="Send invite"
          icon="person-add-outline"
          disabled={!valid}
          loading={invite.isPending}
          onPress={() => invite.mutate({ email: normalizeEmail(email), role })}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one,
  },
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
