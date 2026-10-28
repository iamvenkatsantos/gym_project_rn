import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useProfile, useActiveGym } from '@/features/auth/use-profile';
import { PickRow } from '@/features/coaching/components/pick-row';
import { SaveBar } from '@/features/coaching/components/save-bar';
import { useChangeTrainerLinks, useTrainerLinks } from '@/features/coaching/hooks';
import { membersOf, pickChanges, trainersOf } from '@/features/coaching/rules';
import type { TrainerLink } from '@/features/coaching/types';
import { usePeople } from '@/features/members/hooks';
import { activeCoaches, coachLabel } from '@/features/members/rules';
import type { GymPerson } from '@/features/members/types';

/** Past this many coaches the list gets a search box. */
const SEARCH_FROM = 6;

/** Owners and supervisors tick the trainers a member works with, then save. */
export default function MemberTrainersScreen() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const gym = useActiveGym();
  const people = usePeople(gym.gymId);
  const links = useTrainerLinks(gym.gymId);
  const member = people.data?.find((p) => p.id === memberId);

  if (!member || !links.data) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">
          {people.isPending || links.isPending ? 'Loading…' : 'This member is no longer here.'}
        </ThemedText>
      </Screen>
    );
  }
  return <Picker gymId={gym.gymId} member={member} people={people.data ?? []} links={links.data} />;
}

function Picker({
  gymId,
  member,
  people,
  links,
}: {
  gymId: string;
  member: GymPerson;
  people: GymPerson[];
  links: TrainerLink[];
}) {
  const profile = useProfile();
  const save = useChangeTrainerLinks(gymId, { kind: 'member', id: member.id });
  const saved = trainersOf(links, member.id).map((l) => l.trainerId);
  const [picked, setPicked] = useState<string[]>(saved);
  const [query, setQuery] = useState('');
  const change = pickChanges(saved, picked);
  const firstName = member.fullName.split(' ')[0];
  // Owners and supervisors can coach too, for gyms without (enough) trainers.
  const coaches = activeCoaches(people);
  const q = query.trim().toLowerCase();
  const shown = coaches.filter((c) => !q || c.fullName.toLowerCase().includes(q));

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: `${firstName}'s trainers` }} />
      <Screen>
        <View>
          <ThemedText type="title">{member.fullName}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Tick everyone who trains {firstName}, then save. A member can have more than one
            trainer. Pick yourself when no trainer is free.
          </ThemedText>
        </View>
        {coaches.length > SEARCH_FROM ? (
          <TextField
            label="Find a trainer"
            placeholder="Search by name"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
        ) : null}
        {coaches.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            Nobody active can coach yet. Invite a trainer from People.
          </ThemedText>
        ) : shown.length === 0 ? (
          <ThemedText themeColor="textSecondary">No trainers match.</ThemedText>
        ) : (
          <Card>
            {shown.map((coach, i) => {
              const count = membersOf(links, coach.id).length;
              return (
                <PickRow
                  key={coach.id}
                  name={coachLabel(coach, profile.id)}
                  detail={`${count} member${count === 1 ? '' : 's'}`}
                  checked={picked.includes(coach.id)}
                  divider={i > 0}
                  onPress={() =>
                    setPicked((list) =>
                      list.includes(coach.id)
                        ? list.filter((id) => id !== coach.id)
                        : [...list, coach.id],
                    )
                  }
                />
              );
            })}
          </Card>
        )}
      </Screen>
      <SaveBar
        change={change}
        warning={`Removing a trainer also takes their workout plans off ${firstName}.`}
        error={save.error?.message}
        saving={save.isPending}
        onReset={() => setPicked(saved)}
        onSave={() => save.mutate(change, { onSuccess: () => router.back() })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
