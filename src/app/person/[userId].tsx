import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Pill } from '@/components/pill';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Role } from '@/features/auth/types';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { roleTone } from '@/features/members/components/person-row';
import { usePeople, useRemovePerson, useUpdatePerson } from '@/features/members/hooks';
import { isLastActiveOwner } from '@/features/members/rules';
import { TrainerAvatar } from '@/features/trainers/components/trainer-avatar';
import { formatDate } from '@/lib/format';

export default function PersonScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const profile = useProfile();
  const gym = useActiveGym();
  const people = usePeople(gym.gymId);
  const update = useUpdatePerson(gym.gymId);
  const remove = useRemovePerson(gym.gymId);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const person = people.data?.find((p) => p.id === userId);

  if (!person) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">
          {people.isPending ? 'Loading…' : 'This person is no longer at the gym.'}
        </ThemedText>
      </Screen>
    );
  }

  const lastOwner = isLastActiveOwner(people.data ?? [], person.id);
  const isSelf = person.id === profile.id;
  const suspended = person.status === 'suspended';
  const error = update.error ?? remove.error;

  return (
    <Screen>
      <Stack.Screen options={{ title: person.fullName }} />
      <View style={styles.header}>
        <TrainerAvatar name={person.fullName} size={64} />
        <View style={styles.flex}>
          <ThemedText type="title">{person.fullName}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {person.email}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Joined {formatDate(person.joinedAt)}
          </ThemedText>
        </View>
      </View>
      <View style={styles.pills}>
        <Pill label={person.role} tone={roleTone[person.role]} />
        {suspended ? <Pill label="Suspended" tone="danger" icon="ban-outline" /> : null}
        {isSelf ? <Pill label="You" tone="neutral" /> : null}
      </View>

      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary">
          Role
        </ThemedText>
        <SegmentedControl<Role>
          options={[
            { value: 'member', label: 'Member' },
            { value: 'trainer', label: 'Trainer' },
            { value: 'owner', label: 'Owner' },
          ]}
          value={person.role}
          onChange={(role) => {
            // The last owner's role is locked; the note below says why.
            if (role !== person.role && !lastOwner)
              update.mutate({ userId: person.id, patch: { role } });
          }}
        />
        {person.role === 'trainer' ? (
          <ThemedText type="small" themeColor="textSecondary">
            Trainers show up for 1:1 booking once they set their weekly hours.
          </ThemedText>
        ) : null}
      </View>

      {lastOwner ? (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            {isSelf ? 'You are' : 'This is'} the only owner, so this account can&apos;t be demoted,
            suspended or removed. Make someone else an owner first.
          </ThemedText>
        </Card>
      ) : null}
      {error ? <ThemedText themeColor="danger">{error.message}</ThemedText> : null}

      <Button
        label={suspended ? 'Reactivate' : 'Suspend access'}
        icon={suspended ? 'refresh-outline' : 'ban-outline'}
        variant="secondary"
        disabled={lastOwner}
        loading={update.isPending && update.variables?.patch.status !== undefined}
        onPress={() =>
          update.mutate({
            userId: person.id,
            patch: { status: suspended ? 'active' : 'suspended' },
          })
        }
      />
      <ThemedText type="small" themeColor="textSecondary">
        Suspended people keep their account and history but can&apos;t open this gym in the app.
      </ThemedText>

      {confirmRemove ? (
        <Card>
          <ThemedText type="smallBold">
            Remove {person.fullName} from {gym.gymName}?
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Their account and workout history stay. You can invite them again later.
          </ThemedText>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button
                label="Cancel"
                variant="secondary"
                size="compact"
                onPress={() => setConfirmRemove(false)}
              />
            </View>
            <View style={styles.flex}>
              <Button
                label="Remove"
                variant="danger"
                size="compact"
                loading={remove.isPending}
                onPress={() => remove.mutate(person.id, { onSuccess: () => router.back() })}
              />
            </View>
          </View>
        </Card>
      ) : (
        <Button
          label="Remove from gym"
          variant="danger"
          size="compact"
          disabled={lastOwner}
          onPress={() => setConfirmRemove(true)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  pills: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  field: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
