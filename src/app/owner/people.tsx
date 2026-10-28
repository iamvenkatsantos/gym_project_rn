import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { canCoach } from '@/features/auth/types';
import { useActiveGym } from '@/features/auth/use-profile';
import { useTrainerLinks } from '@/features/coaching/hooks';
import { membersOf, trainersOf } from '@/features/coaching/rules';
import type { TrainerLink } from '@/features/coaching/types';
import { PendingInvites } from '@/features/members/components/pending-invites';
import { PersonRow } from '@/features/members/components/person-row';
import { usePeople } from '@/features/members/hooks';
import { countPeople, filterPeople } from '@/features/members/rules';
import type { GymPerson, PeopleFilter } from '@/features/members/types';

const filters: { value: PeopleFilter; label: string }[] = [
  { value: 'all', label: 'Everyone' },
  { value: 'member', label: 'Members' },
  { value: 'trainer', label: 'Trainers' },
  { value: 'supervisor', label: 'Supervisors' },
  { value: 'owner', label: 'Owners' },
  { value: 'suspended', label: 'Suspended' },
];

/** Everyone at the gym, for owners and supervisors. */
export default function OwnerPeopleScreen() {
  const gym = useActiveGym();
  const people = usePeople(gym.gymId);
  const links = useTrainerLinks(gym.gymId);
  // Supervisors can only withdraw the invites they could have sent.
  const canWithdraw = (role: GymPerson['role']) =>
    gym.role === 'owner' || role === 'member' || role === 'trainer';
  const [filter, setFilter] = useState<PeopleFilter>('all');
  const [query, setQuery] = useState('');

  return (
    <Screen>
      <Button
        label="Invite someone"
        icon="person-add-outline"
        onPress={() => router.push('/invite-person')}
      />

      <PendingInvites gymId={gym.gymId} canWithdraw={canWithdraw} />

      <SectionHeader title="People" />
      <TextField
        label="Search"
        placeholder="Name or email"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <QueryState query={people} isEmpty={(list) => list.length === 0} emptyText="Nobody here yet.">
        {(list) => {
          const counts = countPeople(list);
          const shown = filterPeople(list, filter, query);
          return (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}>
                {filters.map((f) => (
                  <Chip
                    key={f.value}
                    label={`${f.label} ${counts[f.value]}`}
                    selected={filter === f.value}
                    onPress={() => setFilter(f.value)}
                  />
                ))}
              </ScrollView>
              {shown.length === 0 ? (
                <ThemedText themeColor="textSecondary">Nobody matches.</ThemedText>
              ) : (
                <Card>
                  {shown.map((person, i) => (
                    <PersonRow
                      key={person.id}
                      person={person}
                      divider={i > 0}
                      detail={coachingDetail(person, links.data ?? [])}
                      onPress={() =>
                        router.push({ pathname: '/person/[userId]', params: { userId: person.id } })
                      }
                    />
                  ))}
                </Card>
              )}
            </>
          );
        }}
      </QueryState>
    </Screen>
  );
}

/** Who a member trains with, or how many members a trainer has. */
function coachingDetail(person: GymPerson, links: TrainerLink[]) {
  if (person.role === 'member') {
    const trainers = trainersOf(links, person.id).map((l) => l.trainerName);
    return trainers.length ? `Trainer: ${trainers.join(', ')}` : 'No trainer yet';
  }
  if (canCoach(person.role)) {
    const count = membersOf(links, person.id).length;
    // Owners and supervisors only show it when they coach someone.
    if (person.role !== 'trainer' && count === 0) return undefined;
    return `${count} member${count === 1 ? '' : 's'}`;
  }
  return undefined;
}

const styles = StyleSheet.create({
  chips: {
    gap: Spacing.two,
  },
});
