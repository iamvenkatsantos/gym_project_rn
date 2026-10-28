import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { PickRow } from '@/features/coaching/components/pick-row';
import { SaveBar } from '@/features/coaching/components/save-bar';
import { useChangeTrainerLinks, useTrainerLinks } from '@/features/coaching/hooks';
import { membersOf, membersToMatch, pickChanges, trainersOf } from '@/features/coaching/rules';
import type { TrainerLink } from '@/features/coaching/types';
import { usePeople } from '@/features/members/hooks';
import { coachLabel } from '@/features/members/rules';
import type { GymPerson } from '@/features/members/types';

type Filter = 'all' | 'none' | 'theirs';

/** Owners and supervisors tick several members for one trainer, then save them together. */
export default function TrainerMembersScreen() {
  const { trainerId } = useLocalSearchParams<{ trainerId: string }>();
  const gym = useActiveGym();
  const people = usePeople(gym.gymId);
  const links = useTrainerLinks(gym.gymId);
  const coach = people.data?.find((p) => p.id === trainerId);

  if (!coach || !links.data) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">
          {people.isPending || links.isPending ? 'Loading…' : 'This trainer is no longer here.'}
        </ThemedText>
      </Screen>
    );
  }
  return <Picker gymId={gym.gymId} coach={coach} people={people.data ?? []} links={links.data} />;
}

function Picker({
  gymId,
  coach,
  people,
  links,
}: {
  gymId: string;
  coach: GymPerson;
  people: GymPerson[];
  links: TrainerLink[];
}) {
  const profile = useProfile();
  const save = useChangeTrainerLinks(gymId, { kind: 'trainer', id: coach.id });
  const saved = membersOf(links, coach.id).map((l) => l.memberId);
  const [picked, setPicked] = useState<string[]>(saved);
  const [filter, setFilter] = useState<Filter>(saved.length ? 'all' : 'none');
  const [query, setQuery] = useState('');
  const change = pickChanges(saved, picked);
  const name = coachLabel(coach, profile.id);
  const isYou = coach.id === profile.id;

  const members = membersToMatch(people, links, query);
  const counts = {
    all: members.length,
    none: members.filter((m) => trainersOf(links, m.id).length === 0).length,
    theirs: members.filter((m) => saved.includes(m.id)).length,
  };
  // Their own members stay on top, so unticking one by mistake is easy to spot.
  const shown = members
    .filter(
      (m) =>
        filter === 'all' ||
        (filter === 'none' ? trainersOf(links, m.id).length === 0 : saved.includes(m.id)),
    )
    .sort((a, b) => Number(saved.includes(b.id)) - Number(saved.includes(a.id)));

  const filters: { value: Filter; label: string }[] = [
    { value: 'none', label: `No trainer ${counts.none}` },
    { value: 'theirs', label: `${isYou ? 'Yours' : 'Theirs'} ${counts.theirs}` },
    { value: 'all', label: `All ${counts.all}` },
  ];

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{ title: isYou ? 'Your members' : `${coach.fullName.split(' ')[0]}'s members` }}
      />
      <Screen>
        <View>
          <ThemedText type="title">{name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Trains {saved.length} member{saved.length === 1 ? '' : 's'}. Tick the members{' '}
            {isYou ? 'you' : 'they'} should train, then save. Members keep any other trainers.
          </ThemedText>
        </View>
        <TextField
          label="Find a member"
          placeholder="Name or email"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}>
          {filters.map((f) => (
            <Chip
              key={f.value}
              label={f.label}
              selected={filter === f.value}
              onPress={() => setFilter(f.value)}
            />
          ))}
        </ScrollView>
        {shown.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            {filter === 'none' && !query ? 'Every member has a trainer.' : 'Nobody matches.'}
          </ThemedText>
        ) : (
          <Card>
            {shown.map((member, i) => {
              const others = trainersOf(links, member.id).filter((l) => l.trainerId !== coach.id);
              return (
                <PickRow
                  key={member.id}
                  name={member.fullName}
                  detail={
                    others.length
                      ? `Also with ${others.map((l) => l.trainerName).join(', ')}`
                      : saved.includes(member.id)
                        ? undefined
                        : 'No trainer yet'
                  }
                  warn={trainersOf(links, member.id).length === 0}
                  checked={picked.includes(member.id)}
                  divider={i > 0}
                  onPress={() =>
                    setPicked((list) =>
                      list.includes(member.id)
                        ? list.filter((id) => id !== member.id)
                        : [...list, member.id],
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
        warning={`Members you untick lose ${isYou ? 'your' : 'this trainer’s'} workout plans.`}
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
  chips: {
    gap: Spacing.two,
  },
});
