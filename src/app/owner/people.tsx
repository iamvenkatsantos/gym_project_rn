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
import { Spacing } from '@/constants/theme';
import { canCoach } from '@/features/auth/types';
import { useActiveGym } from '@/features/auth/use-profile';
import { useTrainerLinks } from '@/features/coaching/hooks';
import { membersOf, trainersOf } from '@/features/coaching/rules';
import type { TrainerLink } from '@/features/coaching/types';
import { MovedMembers } from '@/features/gym-invites/components/moved-members';
import { PendingInvites } from '@/features/members/components/pending-invites';
import { PersonRow } from '@/features/members/components/person-row';
import { usePeopleCounts, usePeoplePages } from '@/features/members/hooks';
import { isSignedUp } from '@/features/members/rules';
import type { GymPerson, PeopleFilter } from '@/features/members/types';
import { useDebounced } from '@/hooks/use-debounced';
import { useT } from '@/i18n';

const filters: { value: PeopleFilter; label: string }[] = [
  { value: 'all', label: 'Everyone' },
  { value: 'member', label: 'Members' },
  { value: 'trainer', label: 'Trainers' },
  { value: 'supervisor', label: 'Supervisors' },
  { value: 'owner', label: 'Owners' },
  { value: 'suspended', label: 'Suspended' },
];

/** Everyone at the gym, for owners and supervisors, 30 at a time. */
export default function OwnerPeopleScreen() {
  const t = useT();
  const gym = useActiveGym();
  const links = useTrainerLinks(gym.gymId);
  // Supervisors can only withdraw the invites they could have sent.
  const canWithdraw = (role: GymPerson['role']) =>
    gym.role === 'owner' || role === 'member' || role === 'trainer';
  const [filter, setFilter] = useState<PeopleFilter>('all');
  const [query, setQuery] = useState('');
  // 30 at a time, filtered and searched on the server, so a big gym opens as fast as a small one.
  const pages = usePeoplePages(gym.gymId, filter, useDebounced(query.trim()));
  const counts = usePeopleCounts(gym.gymId).data;

  return (
    <Screen>
      <Button
        label="Invite someone"
        icon="person-add-outline"
        onPress={() => router.push('/invite-person')}
      />
      {gym.role === 'owner' ? (
        <Button
          label="Import members from a file"
          icon="cloud-upload-outline"
          variant="secondary"
          onPress={() => router.push('/import-members')}
        />
      ) : null}
      <Button
        label="Match members with trainers"
        icon="git-compare-outline"
        variant="secondary"
        onPress={() => router.push('/match-trainers')}
      />

      <PendingInvites gymId={gym.gymId} gymName={gym.gymName} canWithdraw={canWithdraw} />

      <SectionHeader title="People" />
      <TextField
        label="Search"
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
            label={counts ? `${t(f.label)} ${counts[f.value]}` : t(f.label)}
            selected={filter === f.value}
            onPress={() => setFilter(f.value)}
          />
        ))}
      </ScrollView>
      <QueryState
        query={pages}
        isEmpty={(data) => data.pages[0]?.people.length === 0}
        emptyText={counts?.all === 0 ? 'Nobody here yet.' : 'Nobody matches.'}>
        {(data) => (
          <>
            <Card>
              {data.pages
                .flatMap((page) => page.people)
                .map((person, i) => (
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
            {pages.hasNextPage ? (
              <Button
                label="Show more"
                icon="chevron-down"
                variant="secondary"
                size="compact"
                loading={pages.isFetchingNextPage}
                onPress={() => pages.fetchNextPage()}
              />
            ) : null}
          </>
        )}
      </QueryState>

      <MovedMembers gymId={gym.gymId} />
    </Screen>
  );
}

/** Who a member trains with, or how many members a trainer has. */
function coachingDetail(person: GymPerson, links: TrainerLink[]) {
  if (!isSignedUp(person)) return 'Not joined yet';
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
