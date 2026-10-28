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
import type { Role } from '@/features/auth/types';
import { useActiveGym } from '@/features/auth/use-profile';
import { useIsPlatformAdmin } from '@/features/gyms/hooks';
import { useInvitePerson, usePeople } from '@/features/members/hooks';
import { whatsappUrl } from '@/features/enquiries/rules';
import { parseMobile } from '@/features/members/import-rules';
import { inviteMessage, normalizeEmail } from '@/features/members/rules';
import { validateEmail } from '@/lib/validation';
import type { InviteChannel, InviteOutcome, InviteRole } from '@/features/members/types';

/** Opens a chat with their number, or the share sheet to pick who gets it. */
function sendOnWhatsApp(message: string, mobile: string | null) {
  const opened = mobile ? Linking.openURL(whatsappUrl(mobile, message)) : Share.share({ message });
  opened.catch(() => {});
}

function describe(
  { result, emailSent, emailError }: InviteOutcome,
  email: string,
  role: InviteRole,
  canManage: boolean,
  channel: InviteChannel,
) {
  if (channel === 'whatsapp' && result === 'invited') {
    return {
      title: 'Invite saved',
      detail: `They join once they sign up with ${email}.`,
    };
  }
  if (role === 'gym_owner') {
    const next =
      "After signing in they add their gym's details and get a new, empty gym of their own.";
    if (result === 'added') {
      return {
        title: 'Ready to set up their gym',
        detail: `They already have a CoreFit Gym account. ${next}`,
      };
    }
    return emailSent
      ? { title: 'Invite sent', detail: `We emailed ${email} a link. ${next}` }
      : {
          title: 'Invite saved',
          detail: `${emailError ? `We couldn't email them: ${emailError.replace(/\.?$/, '.')}` : "We couldn't email them."} Ask them to install CoreFit Gym and create an account with this email. ${next}`,
        };
  }
  switch (result) {
    case 'added':
      return {
        title: 'Added to the gym',
        detail:
          'They already had a CoreFit Gym account, so they can use this gym the next time they open the app.',
      };
    case 'already_member':
      return {
        title: 'Already at this gym',
        detail: canManage
          ? 'Find them under People to change their role or reactivate them.'
          : 'Ask the owner or a supervisor if they should be your member.',
      };
    case 'invited':
      return emailSent
        ? {
            title: 'Invite sent',
            detail: `We emailed ${email} a link. It opens CoreFit Gym to set a password, then signs them in to this gym.`,
          }
        : {
            title: 'Invite saved',
            detail: `${emailError ? `We couldn't email them: ${emailError.replace(/\.?$/, '.')}` : "We couldn't email them."} Ask them to install CoreFit Gym and create an account with this email. They join the gym as soon as they confirm it.`,
          };
  }
}

const ownerInviteRoles: { value: Role; label: string }[] = [
  { value: 'member', label: 'Member' },
  { value: 'trainer', label: 'Trainer' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'owner', label: 'Owner' },
];

type OwnerOf = 'new' | 'this';

function roleLabel(role: Role) {
  return role === 'owner' ? 'an owner' : `a ${role}`;
}

export default function InvitePersonScreen() {
  const gym = useActiveGym();
  const invite = useInvitePerson(gym.gymId);
  const isTrainer = gym.role === 'trainer';
  // Trainers can't list everyone at the gym, so they don't get the "already here" details.
  const people = usePeople(gym.gymId, { enabled: !isTrainer });
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [role, setRole] = useState<Role>('member');
  // An owner invite usually means someone opening their own gym, not a partner in this one.
  const [ownerOf, setOwnerOf] = useState<OwnerOf>('new');
  const inviteRole: InviteRole = role === 'owner' && ownerOf === 'new' ? 'gym_owner' : role;
  // Trainers invite members, supervisors members and trainers, owners add supervisors
  // too, and only CoreFit Gym admins add owners. The server checks all of this again.
  const isAdmin = useIsPlatformAdmin();
  const roles = isAdmin
    ? ownerInviteRoles
    : ownerInviteRoles.slice(0, gym.role === 'owner' ? 3 : isTrainer ? 1 : 2);
  const emailError = validateEmail(email);
  const whatsappNumber = mobile.trim() ? parseMobile(mobile) : null;
  const mobileError =
    mobile.trim() && !whatsappNumber ? 'Enter a 10-digit mobile number, or leave it empty.' : null;
  const result = invite.data
    ? describe(
        invite.data,
        invite.variables.email,
        invite.variables.role,
        !isTrainer,
        invite.variables.channel,
      )
    : null;
  const message = invite.data
    ? inviteMessage(gym.gymName, invite.variables.email, invite.variables.role, invite.data.result)
    : null;
  const canMessage =
    invite.variables?.channel === 'whatsapp' && invite.data?.result !== 'already_member';
  const send = (channel: InviteChannel) => {
    const variables = { email: normalizeEmail(email), role: inviteRole, channel };
    invite.mutate(variables, {
      onSuccess: (outcome) => {
        if (channel === 'whatsapp' && outcome.result !== 'already_member') {
          sendOnWhatsApp(
            inviteMessage(gym.gymName, variables.email, variables.role, outcome.result),
            whatsappNumber,
          );
        }
      },
    });
  };
  // Inviting someone who's already here doesn't change their role, and roles never change.
  const existing =
    invite.data?.result === 'already_member'
      ? people.data?.find((p) => p.email === invite.variables?.email)
      : undefined;
  const invitedRole = invite.variables?.role === 'gym_owner' ? undefined : invite.variables?.role;
  const roleDiffers = existing && invitedRole && existing.role !== invitedRole;

  return (
    <Screen refreshable={false}>
      <ThemedText type="small" themeColor="textSecondary">
        {isAdmin
          ? `Invite someone to ${gym.gymName}, or a new gym owner.`
          : gym.role === 'owner'
            ? `Invite someone to ${gym.gymName}.`
            : isTrainer
              ? `Invite a member. They're mapped to you.`
              : `Invite someone to ${gym.gymName}.`}
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
        maxLength={254}
        error={emailError}
      />
      <TextField
        label="Mobile for WhatsApp (optional)"
        placeholder="98400 12345"
        value={mobile}
        onChangeText={(text) => {
          setMobile(text);
          invite.reset();
        }}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        maxLength={16}
        error={mobileError}
      />
      <View style={styles.field}>
        {/* Trainers only invite members, so there's no role to pick. */}
        {roles.length > 1 ? (
          <>
            <ThemedText type="label" themeColor="textSecondary">
              Role
            </ThemedText>
            <SegmentedControl<Role>
              options={roles}
              value={role}
              onChange={(next) => {
                setRole(next);
                invite.reset();
              }}
            />
          </>
        ) : null}
        {role === 'owner' ? (
          <>
            <ThemedText type="label" themeColor="textSecondary">
              Owner of
            </ThemedText>
            <SegmentedControl<OwnerOf>
              options={[
                { value: 'new', label: 'A new gym' },
                { value: 'this', label: 'This gym' },
              ]}
              value={ownerOf}
              onChange={(next) => {
                setOwnerOf(next);
                invite.reset();
              }}
            />
            {ownerOf === 'new' ? (
              <ThemedText type="small" themeColor="textSecondary">
                They set up a gym of their own with its details. It starts empty, and they
                won&apos;t see anyone from {gym.gymName}.
              </ThemedText>
            ) : (
              <ThemedText type="small" themeColor="warning">
                Co-owners can manage everyone at {gym.gymName}, including you.
              </ThemedText>
            )}
          </>
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
            <Icon name="checkmark-circle" size={22} color="accent" />
            <ThemedText type="heading">{result.title}</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {existing && roleDiffers
              ? `${existing.fullName} is already here as ${roleLabel(existing.role)}. Roles can't be changed once given.`
              : result.detail}
          </ThemedText>
        </Card>
      ) : null}
      {invite.error ? <ThemedText themeColor="danger">{invite.error.message}</ThemedText> : null}
      {canMessage && message ? (
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
      ) : (
        <>
          <Button
            label="Invite on WhatsApp"
            icon="logo-whatsapp"
            disabled={!!emailError || !!mobileError}
            loading={invite.isPending && invite.variables?.channel === 'whatsapp'}
            onPress={() => send('whatsapp')}
          />
          <Button
            label="Invite by email"
            icon="mail-outline"
            variant="secondary"
            disabled={!!emailError || invite.isPending}
            loading={invite.isPending && invite.variables?.channel === 'email'}
            onPress={() => send('email')}
          />
        </>
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
