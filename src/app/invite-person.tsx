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
import type { PhotoPose } from '@/features/body/types';
import { BirthDateField } from '@/features/birthdays/components/birth-date-field';
import { useIsPlatformAdmin } from '@/features/gyms/hooks';
import { useInvitePerson, usePeople } from '@/features/members/hooks';
import { whatsappUrl } from '@/features/enquiries/rules';
import { parseMobile } from '@/features/members/import-rules';
import { formatInviteCode, inviteMessage, normalizeEmail } from '@/features/members/rules';
import {
  admissionValues,
  EMPTY_ADMISSION,
  firstAdmissionError,
  validateAdmission,
  type AdmissionTexts,
} from '@/features/onboarding/rules';
import { StartingPhotos } from '@/features/onboarding/components/starting-photos';
import type { PickedPhoto } from '@/features/onboarding/types';
import { validateEmail } from '@/lib/validation';
import type { InviteChannel, InviteOutcome, InviteRole } from '@/features/members/types';

/** Opens a chat with their number, or the share sheet to pick who gets it. */
function sendOnWhatsApp(message: string, mobile: string | null) {
  const opened = mobile ? Linking.openURL(whatsappUrl(mobile, message)) : Share.share({ message });
  opened.catch(() => {});
}

function describe(
  { result, emailSent, emailError, code }: InviteOutcome,
  email: string,
  role: InviteRole,
  canManage: boolean,
  channel: InviteChannel,
) {
  const joins = role === 'gym_owner' ? 'They set up their gym' : 'They join';
  if (result === 'already_member') {
    return {
      title: 'Already at this gym',
      detail: canManage
        ? 'Find them under People.'
        : 'Ask the owner if they should be your member.',
    };
  }
  if (result === 'added') {
    return {
      title: role === 'gym_owner' ? 'Ready to set up their gym' : 'Added to the gym',
      detail: 'They already have an account. It shows next time they open the app.',
    };
  }
  if (channel === 'whatsapp') {
    return code
      ? {
          title: `Code ${formatInviteCode(code)}`,
          detail: `${joins} with this code. It works once, for 7 days.`,
        }
      : { title: 'Invite saved', detail: `${joins} once they sign up with ${email}.` };
  }
  return emailSent
    ? { title: 'Invite sent', detail: `We emailed ${email} a code. ${joins} once they enter it.` }
    : {
        title: 'Invite saved',
        detail: `Email failed${emailError ? `: ${emailError.replace(/\.$/, '')}` : ''}. Ask them to sign up with ${email}.`,
      };
}

/** Who fills in a new member's details: the member on first sign-in, or the inviter now. */
type DetailsBy = 'member' | 'inviter';

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
  const isTrainer = gym.role === 'trainer';
  // Trainers can't list everyone at the gym, so they don't get the "already here" details.
  const people = usePeople(gym.gymId, { enabled: !isTrainer });
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  // WhatsApp or email is picked first; only then do the fields show.
  const [channel, setChannel] = useState<InviteChannel | null>(null);
  const [role, setRole] = useState<Role>('member');
  const [detailsBy, setDetailsBy] = useState<DetailsBy>('member');
  const [details, setDetails] = useState<AdmissionTexts>(EMPTY_ADMISSION);
  const [submitted, setSubmitted] = useState(false);
  const [photos, setPhotos] = useState<Partial<Record<PhotoPose, PickedPhoto>>>({});
  // New gyms and their owners are set up from Admin → Owners; an owner here is a co-owner.
  const inviteRole: InviteRole = role;
  // Trainers invite members, supervisors members and trainers, owners add supervisors
  // too, and only CoreFit admins add co-owners. The server checks all of this again.
  const isAdmin = useIsPlatformAdmin();
  const roles = isAdmin
    ? ownerInviteRoles
    : ownerInviteRoles.slice(0, gym.role === 'owner' ? 3 : isTrainer ? 1 : 2);
  // WhatsApp invites can go without an email: they sign in with the mobile number.
  const emailError = channel === 'whatsapp' && !email.trim() ? null : validateEmail(email);
  const whatsappNumber = parseMobile(mobile);
  const mobileError =
    channel === 'whatsapp' && !whatsappNumber ? 'Enter a 10-digit mobile number.' : null;
  // The inviter can fill in what the member's first-sign-in form asks; then the member skips it.
  const fillDetails = role === 'member' && detailsBy === 'inviter';
  const detailErrors = validateAdmission(
    { ...details, phone: mobile },
    new Set(Object.keys(photos) as PhotoPose[]),
  );
  const detailsProblem = fillDetails ? firstAdmissionError(detailErrors) : null;
  const setDetail = (key: keyof AdmissionTexts) => (text: string) => {
    setDetails((prev) => ({ ...prev, [key]: text }));
    invite.reset();
  };
  // The email the invite went to; without one, the mobile login.
  const sentTo = invite.data?.email ?? invite.variables?.email ?? '';
  const result = invite.data
    ? describe(invite.data, sentTo, invite.variables.role, !isTrainer, invite.variables.channel)
    : null;
  const message = invite.data
    ? inviteMessage(
        gym.gymName,
        sentTo,
        invite.variables.role,
        invite.data.result,
        invite.data.code,
      )
    : null;
  const canMessage =
    invite.variables?.channel === 'whatsapp' && invite.data?.result !== 'already_member';
  const send = (channel: InviteChannel) => {
    setSubmitted(true);
    if (detailsProblem) return;
    const variables = {
      email: normalizeEmail(email),
      role: inviteRole,
      channel,
      phone: channel === 'whatsapp' ? whatsappNumber : null,
      admission: fillDetails ? admissionValues({ ...details, phone: mobile }) : null,
      photos: fillDetails ? photos : null,
    };
    invite.mutate(variables, {
      onSuccess: (outcome) => {
        if (channel === 'whatsapp' && outcome.result !== 'already_member') {
          sendOnWhatsApp(
            inviteMessage(
              gym.gymName,
              outcome.email ?? variables.email,
              variables.role,
              outcome.result,
              outcome.code,
            ),
            whatsappNumber,
          );
        }
      },
    });
  };
  // Inviting someone who's already here doesn't change their role, and roles never change.
  const existing =
    invite.data?.result === 'already_member'
      ? people.data?.find((p) => p.email === sentTo)
      : undefined;
  const invitedRole = invite.variables?.role === 'gym_owner' ? undefined : invite.variables?.role;
  const roleDiffers = existing && invitedRole && existing.role !== invitedRole;

  return (
    <Screen refreshable={false}>
      <ThemedText type="small" themeColor="textSecondary">
        {isTrainer
          ? "Invite a member. They're mapped to you."
          : `Invite someone to ${gym.gymName}.`}
      </ThemedText>

      {channel === null ? (
        <>
          <Button
            label="Invite on WhatsApp"
            icon="logo-whatsapp"
            onPress={() => setChannel('whatsapp')}
          />
          <Button
            label="Invite by email"
            icon="mail-outline"
            variant="secondary"
            onPress={() => setChannel('email')}
          />
        </>
      ) : (
        <>
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
          {channel === 'whatsapp' || fillDetails ? (
            <TextField
              label="Mobile"
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
              error={fillDetails ? detailErrors.phone : mobile ? mobileError : null}
              showError={fillDetails ? submitted : undefined}
            />
          ) : null}
          <TextField
            label={channel === 'whatsapp' ? 'Email (optional)' : 'Email'}
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
            error={email ? emailError : null}
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
              <ThemedText type="small" themeColor="warning">
                Co-owners can manage everyone here. New gyms: Admin → Owners.
              </ThemedText>
            ) : role === 'supervisor' ? (
              <ThemedText type="small" themeColor="textSecondary">
                Supervisors record payments and invite members and trainers.
              </ThemedText>
            ) : null}
          </View>

          {role === 'member' ? (
            <View style={styles.field}>
              <ThemedText type="label" themeColor="textSecondary">
                Member details
              </ThemedText>
              <SegmentedControl<DetailsBy>
                options={[
                  { value: 'member', label: 'They fill in' },
                  { value: 'inviter', label: 'Fill in now' },
                ]}
                value={detailsBy}
                onChange={(next) => {
                  setDetailsBy(next);
                  invite.reset();
                }}
              />
              <ThemedText type="small" themeColor="textSecondary">
                {fillDetails
                  ? 'They skip the form and go straight to Home.'
                  : 'They fill in a short form on first sign-in.'}
              </ThemedText>
            </View>
          ) : null}
          {fillDetails ? (
            <>
              <TextField
                label="Full name"
                value={details.fullName}
                onChangeText={setDetail('fullName')}
                autoComplete="name"
                textContentType="name"
                maxLength={60}
                error={detailErrors.fullName}
                showError={submitted}
              />
              <BirthDateField
                value={details.dateOfBirth}
                onChangeText={setDetail('dateOfBirth')}
                error={detailErrors.dateOfBirth}
                showError={submitted}
              />
              <View style={styles.row}>
                <View style={styles.flex}>
                  <TextField
                    label="Weight (kg)"
                    placeholder="72.5"
                    value={details.weight}
                    onChangeText={setDetail('weight')}
                    keyboardType="decimal-pad"
                    maxLength={5}
                    error={detailErrors.weight}
                    showError={submitted}
                  />
                </View>
                <View style={styles.flex}>
                  <TextField
                    label="Height (cm)"
                    placeholder="170"
                    value={details.height}
                    onChangeText={setDetail('height')}
                    keyboardType="decimal-pad"
                    maxLength={5}
                    error={detailErrors.height}
                    showError={submitted}
                  />
                </View>
              </View>
              <ThemedText type="label" themeColor="textSecondary">
                Starting photos
              </ThemedText>
              <StartingPhotos
                uriFor={(pose) => photos[pose]?.uri}
                onPick={(pose, photo) => {
                  setPhotos((prev) => ({ ...prev, [pose]: photo }));
                  invite.reset();
                }}
                highlightMissing={submitted}
              />
              {submitted && detailErrors.photos ? (
                <ThemedText type="small" themeColor="danger">
                  {detailErrors.photos}
                </ThemedText>
              ) : null}
            </>
          ) : null}

          {result ? (
            <Card highlighted>
              <View style={styles.result}>
                <Icon name="checkmark-circle" size={22} color="accent" />
                <ThemedText type="heading">{result.title}</ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {existing && roleDiffers
                  ? `${existing.fullName} is already here as ${roleLabel(existing.role)}. Roles can't be changed.`
                  : result.detail}
              </ThemedText>
            </Card>
          ) : null}
          {invite.data?.detailsError ? (
            <ThemedText type="small" themeColor="danger">
              Details not saved: {invite.data.detailsError.replace(/\.$/, '')}. They fill in the
              form instead.
            </ThemedText>
          ) : null}
          {invite.error ? (
            <ThemedText themeColor="danger">{invite.error.message}</ThemedText>
          ) : null}
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
                    setDetails(EMPTY_ADMISSION);
                    setPhotos({});
                    setSubmitted(false);
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
              onPress={() => send('whatsapp')}
            />
          ) : (
            <Button
              label="Send email invite"
              icon="mail-outline"
              disabled={!!emailError}
              loading={invite.isPending}
              onPress={() => send('email')}
            />
          )}
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
