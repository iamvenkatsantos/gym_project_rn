import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSendBirthdayWish } from '@/features/birthdays/hooks';
import { birthdayMessage } from '@/features/birthdays/rules';
import { whatsappUrl } from '@/features/enquiries/rules';
import type { GymPerson } from '@/features/members/types';

/** On a member's birthday: a wish from the gym (inbox and push), and one on WhatsApp. */
export function BirthdayWish({
  gymId,
  gymName,
  person,
}: {
  gymId: string;
  gymName: string;
  person: GymPerson;
}) {
  const wish = useSendBirthdayWish(gymId, gymName);
  const note = wish.isSuccess
    ? wish.data
      ? 'Wish sent'
      : 'Already wished this year'
    : wish.error
      ? `Couldn't send: ${wish.error.message}`
      : null;

  return (
    <>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button
            label={wish.isSuccess ? 'Wished' : 'Send wish'}
            icon="gift-outline"
            size="compact"
            disabled={wish.isSuccess}
            loading={wish.isPending}
            onPress={() => wish.mutate(person.id)}
          />
        </View>
        {person.phone ? (
          <View style={styles.flex}>
            <Button
              label="WhatsApp"
              icon="logo-whatsapp"
              variant="secondary"
              size="compact"
              onPress={() =>
                Linking.openURL(
                  whatsappUrl(person.phone!, birthdayMessage(person.fullName, gymName)),
                ).catch(() => {})
              }
            />
          </View>
        ) : null}
      </View>
      {note ? (
        <ThemedText type="small" themeColor={wish.error ? 'danger' : 'textSecondary'}>
          {note}
        </ThemedText>
      ) : null}
    </>
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
