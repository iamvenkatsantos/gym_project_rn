import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { SectionHeader } from '@/components/section-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { validateGymDetails } from '@/features/gyms/rules';
import type { GymDetails } from '@/features/gyms/types';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  initial: GymDetails;
  submitLabel: string;
  pending: boolean;
  error: Error | null;
  onSubmit: (details: GymDetails) => void;
};

type Field = keyof GymDetails;
type Input = ComponentRef<typeof TextInput>;
const order: Field[] = ['name', 'address', 'city', 'phone', 'email'];

/**
 * The gym's name, address and front-desk contact, for setting up a gym or editing it.
 * The keyboard's next key walks through the fields. Submitting with a mistake shows every
 * error and jumps to the first one, rather than leaving a greyed-out button unexplained.
 */
export function GymDetailsForm({ initial, submitLabel, pending, error, onSubmit }: Props) {
  const theme = useTheme();
  const [details, setDetails] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const errors = validateGymDetails(details);
  const nameRef = useRef<Input>(null);
  const addressRef = useRef<Input>(null);
  const cityRef = useRef<Input>(null);
  const phoneRef = useRef<Input>(null);
  const emailRef = useRef<Input>(null);
  // Only read from event handlers.
  const focus = (field: Field) =>
    ({ name: nameRef, address: addressRef, city: cityRef, phone: phoneRef, email: emailRef })[
      field
    ].current?.focus();

  const set = (field: Field) => (text: string) => setDetails((d) => ({ ...d, [field]: text }));

  const submit = () => {
    const invalid = order.find((field) => errors[field]);
    if (!invalid) return onSubmit(details);
    setSubmitted(true);
    focus(invalid);
  };

  const focusAfter = (field: Field) => {
    const next = order[order.indexOf(field) + 1];
    if (next) focus(next);
    else submit();
  };

  return (
    <>
      <SectionHeader title="Your gym" />
      <TextField
        label="Gym name"
        placeholder="e.g. Iron House Velachery"
        icon="barbell-outline"
        autoCapitalize="words"
        maxLength={80}
        ref={nameRef}
        value={details.name}
        onChangeText={set('name')}
        error={errors.name}
        showError={submitted}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => focusAfter('name')}
      />

      <SectionHeader title="Location" detail="Optional" />
      <TextField
        label="Address"
        placeholder="Door no, street, area"
        icon="location-outline"
        autoCapitalize="words"
        textContentType="fullStreetAddress"
        autoComplete="street-address"
        maxLength={200}
        multiline
        // Return moves on to the city instead of adding a line; long addresses still wrap.
        ref={addressRef}
        value={details.address}
        onChangeText={set('address')}
        error={errors.address}
        showError={submitted}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => focusAfter('address')}
      />
      <TextField
        label="City"
        placeholder="Chennai"
        icon="business-outline"
        autoCapitalize="words"
        textContentType="addressCity"
        maxLength={60}
        ref={cityRef}
        value={details.city}
        onChangeText={set('city')}
        error={errors.city}
        showError={submitted}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => focusAfter('city')}
      />

      <SectionHeader title="Front desk" detail="Optional" />
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        Shown to your members so they can reach you.
      </ThemedText>
      <TextField
        label="Phone"
        placeholder="98400 12345 or 044 2345 6789"
        icon="call-outline"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        maxLength={18}
        ref={phoneRef}
        value={details.phone}
        onChangeText={set('phone')}
        error={errors.phone}
        showError={submitted}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => focusAfter('phone')}
      />
      <TextField
        label="Email"
        placeholder="desk@yourgym.in"
        icon="mail-outline"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        maxLength={254}
        ref={emailRef}
        value={details.email}
        onChangeText={set('email')}
        error={errors.email}
        showError={submitted}
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={() => focusAfter('email')}
      />

      {error ? (
        <Card style={[styles.error, { borderColor: theme.danger }]}>
          <Icon name="alert-circle-outline" size={20} color="danger" />
          <View style={styles.flex}>
            <ThemedText type="smallBold">Couldn&apos;t save the gym</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {error.message}
            </ThemedText>
          </View>
        </Card>
      ) : null}
      <View style={styles.submit}>
        <Button label={submitLabel} icon="checkmark" loading={pending} onPress={submit} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  hint: {
    marginTop: -Spacing.two,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
  },
  flex: {
    flex: 1,
    gap: Spacing.half,
  },
  submit: {
    marginTop: Spacing.two,
  },
});
