import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { BirthDateField } from '@/features/birthdays/components/birth-date-field';
import { BirthdayWish } from '@/features/birthdays/components/birthday-wish';
import { useSetMemberBirthday } from '@/features/birthdays/hooks';
import {
  ageOn,
  birthDateInput,
  birthdayLabel,
  isBirthdayToday,
  parseBirthDate,
  validateBirthDate,
} from '@/features/birthdays/rules';
import type { GymPerson } from '@/features/members/types';

/**
 * A member's birthday on their person screen: the date and age, wish buttons on the
 * day, and a way for owners and supervisors to add or fix it.
 */
export function MemberBirthday({
  gymId,
  gymName,
  person,
}: {
  gymId: string;
  gymName: string;
  person: GymPerson;
}) {
  const save = useSetMemberBirthday(gymId);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const dob = person.dateOfBirth;
  const today = isBirthdayToday(dob);
  const error = validateBirthDate(text, { required: true });

  const startEditing = () => {
    setText(birthDateInput(dob));
    setSubmitted(false);
    save.reset();
    setEditing(true);
  };

  const submit = () => {
    setSubmitted(true);
    if (error) return;
    save.mutate(
      { memberId: person.id, dateOfBirth: parseBirthDate(text)! },
      { onSuccess: () => setEditing(false) },
    );
  };

  return (
    <Card highlighted={today}>
      <ThemedText type="label" themeColor="textSecondary">
        Birthday
      </ThemedText>
      {editing ? (
        <>
          <BirthDateField value={text} onChangeText={setText} error={error} showError={submitted} />
          {save.error ? (
            <ThemedText type="small" themeColor="danger">
              {save.error.message}
            </ThemedText>
          ) : null}
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button
                label="Cancel"
                variant="secondary"
                size="compact"
                onPress={() => setEditing(false)}
              />
            </View>
            <View style={styles.flex}>
              <Button label="Save" size="compact" loading={save.isPending} onPress={submit} />
            </View>
          </View>
        </>
      ) : (
        <>
          {dob ? (
            <ThemedText type={today ? 'smallBold' : 'default'}>
              {today
                ? `Today! Turns ${ageOn(dob)} 🎂`
                : `${birthdayLabel(dob)} · ${ageOn(dob)} years`}
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Not added yet.
            </ThemedText>
          )}
          {dob && today ? <BirthdayWish gymId={gymId} gymName={gymName} person={person} /> : null}
          <Button
            label={dob ? 'Change birthday' : 'Add birthday'}
            icon="calendar-outline"
            variant="secondary"
            size="compact"
            onPress={startEditing}
          />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
