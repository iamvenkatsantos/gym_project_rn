import { useState } from 'react';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { validateGymDetails } from '@/features/gyms/rules';
import type { GymDetails } from '@/features/gyms/types';
import { firstError } from '@/lib/validation';

type Props = {
  initial: GymDetails;
  submitLabel: string;
  pending: boolean;
  error: Error | null;
  onSubmit: (details: GymDetails) => void;
};

/** The gym's name, address and front-desk contact, for setting up a gym or editing it. */
export function GymDetailsForm({ initial, submitLabel, pending, error, onSubmit }: Props) {
  const [details, setDetails] = useState(initial);
  const errors = validateGymDetails(details);
  const problem = firstError(...Object.values(errors));
  const set = (field: keyof GymDetails) => (text: string) =>
    setDetails((d) => ({ ...d, [field]: text }));

  return (
    <>
      <TextField
        label="Gym name"
        placeholder="e.g. Iron House Velachery"
        icon="barbell-outline"
        value={details.name}
        onChangeText={set('name')}
        maxLength={80}
        error={errors.name}
      />
      <TextField
        label="Address (optional)"
        placeholder="Door no, street, area"
        icon="location-outline"
        value={details.address}
        onChangeText={set('address')}
        maxLength={200}
        multiline
        error={errors.address}
      />
      <TextField
        label="City (optional)"
        placeholder="Chennai"
        icon="business-outline"
        value={details.city}
        onChangeText={set('city')}
        maxLength={60}
        error={errors.city}
      />
      <TextField
        label="Front desk phone (optional)"
        placeholder="98400 12345"
        icon="call-outline"
        value={details.phone}
        onChangeText={set('phone')}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        maxLength={16}
        error={errors.phone}
      />
      <TextField
        label="Gym email (optional)"
        placeholder="desk@yourgym.in"
        icon="mail-outline"
        value={details.email}
        onChangeText={set('email')}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        maxLength={254}
        error={errors.email}
      />
      {error ? <ThemedText themeColor="danger">{error.message}</ThemedText> : null}
      <Button
        label={submitLabel}
        icon="checkmark"
        disabled={!!problem}
        loading={pending}
        onPress={() => onSubmit(details)}
      />
    </>
  );
}
