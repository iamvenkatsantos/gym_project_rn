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
import { useInvitePerson, usePeople, useUpdatePerson } from '@/features/members/hooks';
import { normalizeEmail } from '@/features/members/rules';
import { validateEmail } from '@/lib/validation';
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

const ownerInviteRoles: { value: Role; label: string }[] = [
  { value: 'member', label: 'Member' },
  { value: 'trainer', label: 'Trainer' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'owner', label: 'Owner' },
];

function roleLabel(role: Role) {
  return role === 'owner' ? 'an owner' : `a ${role}`;
}

export default function InvitePersonScreen() {
  const gym = useActiveGym();
  const invite = useInvitePerson(gym.gymId);
  const people = usePeople(gym.gymId);
  const update = useUpdatePerson(gym.gymId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');
  // Supervisors invite members and trainers; only owners add supervisors and owners.
  const roles = gym.role === 'owner' ? ownerInviteRoles : ownerInviteRoles.slice(0, 2);
  const emailError = validateEmail(email);
  const result = invite.data ? describe(invite.data, invite.variables.email) : null;
  // Inviting someone who's already here doesn't change their role, so offer that instead.
  const existing =
    invite.data?.result === 'already_member'
      ? people.data?.find((p) => p.email === invite.variables?.email)
      : undefined;
  const roleDiffers = existing && existing.role !== invite.variables?.role;

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        {gym.role === 'owner'
          ? `Add a member, trainer, supervisor or co-owner to ${gym.gymName} by their email address.`
          : `Add a member or trainer to ${gym.gymName} by their email address.`}
      </ThemedText>
      <TextField
        label="Email"
        placeholder="name@example.com"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          invite.reset();
          update.reset();
        }}
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        maxLength={254}
        error={emailError}
      />
      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary">
          Role
        </ThemedText>
        <SegmentedControl<Role>
          options={roles}
          value={role}
          onChange={(next) => {
            setRole(next);
            invite.reset();
            update.reset();
          }}
        />
        {role === 'owner' ? (
          <ThemedText type="small" themeColor="warning">
            Owners can manage everyone at this gym, including you.
          </ThemedText>
        ) : role === 'supervisor' ? (
          <ThemedText type="small" themeColor="textSecondary">
            Supervisors record payments, invite members and trainers, and match members with
            trainers. They can&apos;t change roles or remove anyone.
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
            {existing && roleDiffers
              ? `${existing.fullName} is already here as ${roleLabel(existing.role)}, so their role didn't change.`
              : result.detail}
          </ThemedText>
          {existing && roleDiffers && invite.variables ? (
            gym.role === 'owner' ? (
              <Button
                label={
                  update.isSuccess
                    ? `Now ${roleLabel(invite.variables.role)}`
                    : `Make them ${roleLabel(invite.variables.role)}`
                }
                icon="swap-horizontal-outline"
                size="compact"
                disabled={update.isSuccess}
                loading={update.isPending}
                onPress={() =>
                  update.mutate({ userId: existing.id, patch: { role: invite.variables!.role } })
                }
              />
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                Ask the owner to change their role.
              </ThemedText>
            )
          ) : null}
          {update.error ? (
            <ThemedText type="small" themeColor="danger">
              {update.error.message}
            </ThemedText>
          ) : null}
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
                update.reset();
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
          disabled={!!emailError}
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
