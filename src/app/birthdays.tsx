import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym } from '@/features/auth/use-profile';
import { BirthdayWish } from '@/features/birthdays/components/birthday-wish';
import {
  birthdayLabel,
  missingBirthdays,
  UPCOMING_DAYS,
  upcomingBirthdays,
  whenLabel,
} from '@/features/birthdays/rules';
import { PersonRow } from '@/features/members/components/person-row';
import { usePeople } from '@/features/members/hooks';
import { TrainerAvatar } from '@/features/trainers/components/trainer-avatar';

const openPerson = (userId: string) =>
  router.push({ pathname: '/person/[userId]', params: { userId } });

/** Today's member birthdays with wish buttons, then the next month's. Owners and supervisors. */
export default function BirthdaysScreen() {
  const gym = useActiveGym();
  const people = usePeople(gym.gymId);

  return (
    <Screen>
      <QueryState query={people}>
        {(list) => {
          const upcoming = upcomingBirthdays(list);
          const today = upcoming.filter((b) => b.days === 0);
          const later = upcoming.filter((b) => b.days > 0);
          const missing = missingBirthdays(list);
          return (
            <>
              <SectionHeader title="Today" detail={today.length ? `${today.length}` : undefined} />
              {today.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  No birthdays today.
                </ThemedText>
              ) : null}
              {today.map(({ person, turning }) => (
                <Card key={person.id} highlighted>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${person.fullName}, turns ${turning} today`}
                    onPress={() => openPerson(person.id)}
                    style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
                    <TrainerAvatar name={person.fullName} url={person.avatarUrl} size={44} />
                    <View style={styles.flex}>
                      <ThemedText type="smallBold">{person.fullName}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Turns {turning} today 🎂
                      </ThemedText>
                    </View>
                  </Pressable>
                  <BirthdayWish gymId={gym.gymId} gymName={gym.gymName} person={person} />
                </Card>
              ))}

              <SectionHeader
                title={`Next ${UPCOMING_DAYS} days`}
                detail={later.length ? `${later.length}` : undefined}
              />
              {later.length ? (
                <Card>
                  {later.map(({ person, days, turning }, i) => (
                    <PersonRow
                      key={person.id}
                      person={person}
                      divider={i > 0}
                      detail={`${whenLabel(days)} · ${birthdayLabel(person.dateOfBirth!)} · turns ${turning}`}
                      hideEmail
                      hideRole
                      onPress={() => openPerson(person.id)}
                    />
                  ))}
                </Card>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  None coming up.
                </ThemedText>
              )}

              {missing ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {missing} member{missing === 1 ? ' has' : 's have'} no birthday on file.
                </ThemedText>
              ) : null}
            </>
          );
        }}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
