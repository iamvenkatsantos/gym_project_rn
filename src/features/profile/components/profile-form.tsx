import { useState } from 'react';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useProfile } from '@/features/auth/use-profile';
import { BirthDateField } from '@/features/birthdays/components/birth-date-field';
import { birthDateInput } from '@/features/birthdays/rules';
import type { PickedPhoto } from '@/features/onboarding/types';
import { ProfilePhotoPicker } from '@/features/profile/components/profile-photo-picker';
import { useSaveProfile } from '@/features/profile/hooks';
import {
  firstProfileError,
  profileValues,
  validateProfile,
  type ProfileTexts,
} from '@/features/profile/rules';

/**
 * Photo (optional), name and mobile (required) and date of birth (optional) for the
 * signed-in person, saved in one go. Used on the first-sign-in profile screen and on
 * Edit profile. The date of birth only shows once the server can keep it.
 */
export function ProfileForm({
  submitLabel,
  onSaved,
}: {
  submitLabel: string;
  onSaved: () => void;
}) {
  const profile = useProfile();
  const save = useSaveProfile(profile.id, profile.avatarPath);
  const [texts, setTexts] = useState<ProfileTexts>({
    fullName: profile.fullName,
    phone: profile.phone ?? '',
    dateOfBirth: birthDateInput(profile.dateOfBirth),
  });
  const canSaveBirthday = profile.dateOfBirth !== undefined;
  // undefined keeps the current photo, null removes it.
  const [photo, setPhoto] = useState<PickedPhoto | null | undefined>(undefined);
  const [submitted, setSubmitted] = useState(false);

  const errors = validateProfile(texts);
  const problem = firstProfileError(errors);
  const shownUri = photo === undefined ? profile.avatarUrl : photo?.uri;

  const set = (key: keyof ProfileTexts) => (text: string) =>
    setTexts((prev) => ({ ...prev, [key]: text }));

  const submit = () => {
    setSubmitted(true);
    if (problem) return;
    const { dateOfBirth, ...values } = profileValues(texts);
    save.mutate(
      { ...values, dateOfBirth: canSaveBirthday ? dateOfBirth : undefined, photo },
      { onSuccess: onSaved },
    );
  };

  return (
    <>
      <ProfilePhotoPicker
        name={texts.fullName || profile.fullName}
        uri={shownUri}
        onPick={setPhoto}
        onRemove={shownUri ? () => setPhoto(null) : undefined}
      />
      <TextField
        label="Full name"
        value={texts.fullName}
        onChangeText={set('fullName')}
        autoComplete="name"
        textContentType="name"
        maxLength={60}
        error={errors.fullName}
        showError={submitted}
      />
      <TextField
        label="Mobile number"
        placeholder="98765 43210"
        value={texts.phone}
        onChangeText={set('phone')}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={16}
        error={errors.phone}
        showError={submitted}
      />
      {canSaveBirthday ? (
        <BirthDateField
          label="Date of birth (optional)"
          value={texts.dateOfBirth}
          onChangeText={set('dateOfBirth')}
          error={errors.dateOfBirth}
          showError={submitted}
        />
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        Only your gym&apos;s managers and, for members, their trainers see your mobile and birthday.
      </ThemedText>
      {save.error ? (
        <ThemedText themeColor="danger">Couldn&apos;t save: {save.error.message}</ThemedText>
      ) : null}
      <Button label={submitLabel} icon="checkmark" loading={save.isPending} onPress={submit} />
    </>
  );
}
