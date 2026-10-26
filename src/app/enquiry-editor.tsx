import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { FollowUpPicker } from '@/features/enquiries/components/follow-up-picker';
import { useCreateEnquiry, useEnquiries, useUpdateEnquiry } from '@/features/enquiries/hooks';
import {
  defaultFollowUp,
  findDuplicate,
  followUpProblem,
  normalizePhone,
  sourceOptions,
} from '@/features/enquiries/rules';
import type { Enquiry, EnquirySource } from '@/features/enquiries/types';
import { usePeople } from '@/features/members/hooks';
import { formatDate } from '@/lib/format';
import {
  firstError,
  normalizeEmail,
  validateEmail,
  validateName,
  validateOptionalText,
  validatePhone,
} from '@/lib/validation';

/** Adds a walk-in or caller, or edits one's details. */
export default function EnquiryEditorScreen() {
  const { enquiryId } = useLocalSearchParams<{ enquiryId?: string }>();
  const gym = useActiveGym();
  const enquiries = useEnquiries(gym.gymId);
  const enquiry = enquiries.data?.find((e) => e.id === enquiryId);

  if (enquiryId && !enquiry) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">
          {enquiries.isPending ? 'Loading…' : 'This enquiry was deleted.'}
        </ThemedText>
      </Screen>
    );
  }
  return <EnquiryForm key={enquiry?.id ?? 'new'} gymId={gym.gymId} enquiry={enquiry} />;
}

function EnquiryForm({ gymId, enquiry }: { gymId: string; enquiry?: Enquiry }) {
  const profile = useProfile();
  const enquiries = useEnquiries(gymId);
  const people = usePeople(gymId);
  const create = useCreateEnquiry(gymId);
  const update = useUpdateEnquiry();
  const [fullName, setFullName] = useState(enquiry?.fullName ?? '');
  const [phone, setPhone] = useState(enquiry?.phone ?? '');
  const [email, setEmail] = useState(enquiry?.email ?? '');
  const [source, setSource] = useState<EnquirySource>(enquiry?.source ?? 'walk_in');
  const [interest, setInterest] = useState(enquiry?.interest ?? '');
  const [assignedTo, setAssignedTo] = useState(enquiry?.assignedTo ?? profile.id);
  const [followUp, setFollowUp] = useState<Date | null>(() => defaultFollowUp());
  const [touched, setTouched] = useState(false);

  // Reminders go to whoever follows up, so only the front desk can be picked.
  const staff = (people.data ?? []).filter(
    (p) => p.status === 'active' && (p.role === 'owner' || p.role === 'supervisor'),
  );
  const nameError = validateName(fullName);
  const phoneError = validatePhone(phone);
  const emailError = email.trim() ? validateEmail(email) : null;
  const interestError = validateOptionalText(interest, 200);
  const followUpError = enquiry ? null : followUpProblem(followUp);
  const problem = firstError(nameError, phoneError, emailError, interestError, followUpError);
  const duplicate =
    !phoneError && enquiries.data ? findDuplicate(enquiries.data, phone, enquiry?.id) : undefined;
  const error = create.error ?? update.error;

  const save = () => {
    setTouched(true);
    if (problem) return;
    const input = {
      fullName: fullName.trim(),
      phone: normalizePhone(phone),
      email: email.trim() ? normalizeEmail(email) : null,
      source,
      interest: interest.trim(),
    };
    if (enquiry) {
      update.mutate(
        { enquiryId: enquiry.id, patch: { ...input, assignedTo } },
        { onSuccess: () => router.back() },
      );
    } else {
      create.mutate(
        { ...input, assignedTo, nextFollowUpAt: followUp?.toISOString() ?? null },
        {
          onSuccess: (created) =>
            router.replace({
              pathname: '/enquiry/[enquiryId]',
              params: { enquiryId: created.id },
            }),
        },
      );
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: enquiry ? 'Edit enquiry' : 'New enquiry' }} />
      <TextField
        label="Name"
        placeholder="Their full name"
        value={fullName}
        onChangeText={setFullName}
        autoCapitalize="words"
        textContentType="name"
        maxLength={60}
        error={nameError}
        showError={touched}
      />
      <TextField
        label="Mobile"
        placeholder="98400 12345"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        maxLength={16}
        icon="call-outline"
        error={phoneError}
        showError={touched}
      />
      {duplicate ? (
        <Card>
          <ThemedText type="small" themeColor="warning">
            {duplicate.fullName} enquired with this number on {formatDate(duplicate.createdAt)}.
          </ThemedText>
          <Button
            label="Open their enquiry"
            size="compact"
            variant="secondary"
            onPress={() =>
              router.replace({
                pathname: '/enquiry/[enquiryId]',
                params: { enquiryId: duplicate.id },
              })
            }
          />
        </Card>
      ) : null}
      <TextField
        label="Email (optional)"
        placeholder="Needed to invite them as a member"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        maxLength={254}
        error={emailError}
      />

      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary">
          How they found us
        </ThemedText>
        <View style={styles.wrap}>
          {sourceOptions.map((o) => (
            <Chip
              key={o.value}
              label={o.label}
              selected={source === o.value}
              onPress={() => setSource(o.value)}
            />
          ))}
        </View>
      </View>

      <TextField
        label="Interested in"
        placeholder="Goal, plan or timings, e.g. weight loss, evening batch"
        value={interest}
        onChangeText={setInterest}
        multiline
        maxLength={200}
        error={interestError}
      />

      {staff.length > 1 ? (
        <View style={styles.field}>
          <ThemedText type="label" themeColor="textSecondary">
            Who follows up
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}>
            {staff.map((p) => (
              <Chip
                key={p.id}
                label={p.id === profile.id ? 'Me' : p.fullName}
                selected={assignedTo === p.id}
                onPress={() => setAssignedTo(p.id)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {enquiry ? null : (
        <>
          <FollowUpPicker value={followUp} onChange={setFollowUp} label="Follow up" />
          {followUpError ? (
            <ThemedText type="small" themeColor="danger">
              {followUpError}
            </ThemedText>
          ) : null}
        </>
      )}

      {error ? (
        <ThemedText themeColor="danger">Couldn&apos;t save: {error.message}</ThemedText>
      ) : null}
      <Button
        label={enquiry ? 'Save changes' : 'Save enquiry'}
        icon="checkmark"
        disabled={touched && !!problem}
        loading={create.isPending || update.isPending}
        onPress={save}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chips: {
    gap: Spacing.two,
  },
});
