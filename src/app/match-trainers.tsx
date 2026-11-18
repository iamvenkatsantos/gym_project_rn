import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { SegmentedControl } from '@/components/segmented-control';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { TrainerRequestRow } from '@/features/coaching/components/trainer-request-row';
import { useTrainerLinks, useTrainerRequests } from '@/features/coaching/hooks';
import { membersOf, pendingRequests } from '@/features/coaching/rules';
import { PersonRow } from '@/features/members/components/person-row';
import { useDebounced, useMatchMembersPage, usePeople } from '@/features/members/hooks';
import { activeCoaches, coachLabel } from '@/features/members/rules';

type Tab = 'members' | 'trainers';

/**
 * One place to match members with trainers: members without one come first, and each
 * trainer opens a list to add several members at once.
 */
export default function MatchTrainersScreen() {
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const profile = useProfile();
  const gym = useActiveGym();
  const requests = useTrainerRequests(gym.gymId);
  const [tab, setTab] = useState<Tab>(params.tab === 'trainers' ? 'trainers' : 'members');
  const [onlyUnmatched, setOnlyUnmatched] = useState(true);
  const [query, setQuery] = useState('');
  // By member: a page of members with their trainers' names, from the server. Everyone and every
  // trainer link load only for By trainer, which lists the (few) coaches.
  const page = useMatchMembersPage(gym.gymId, onlyUnmatched, useDebounced(query));
  const people = usePeople(gym.gymId, { enabled: tab === 'trainers' });
  const links = useTrainerLinks(gym.gymId, {}, { enabled: tab === 'trainers' });
  const waiting = requests.data ? pendingRequests(requests.data) : [];

  return (
    <Screen>
      <SegmentedControl<Tab>
        options={[
          { value: 'members', label: 'By member' },
          { value: 'trainers', label: 'By trainer' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'trainers' ? (
        <QueryState query={people}>
          {(list) => {
            const allLinks = links.data ?? [];
            const coaches = activeCoaches(list);
            return (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  Open a trainer to add or remove several members at once.
                </ThemedText>
                {coaches.length === 0 ? (
                  <ThemedText themeColor="textSecondary">
                    Nobody active can coach yet. Invite a trainer from People.
                  </ThemedText>
                ) : (
                  <Card>
                    {coaches.map((coach, i) => {
                      const count = membersOf(allLinks, coach.id).length;
                      return (
                        <PersonRow
                          key={coach.id}
                          person={{ ...coach, fullName: coachLabel(coach, profile.id) }}
                          divider={i > 0}
                          detail={`${count} member${count === 1 ? '' : 's'}`}
                          hideEmail
                          onPress={() =>
                            router.push({
                              pathname: '/trainer-members/[trainerId]',
                              params: { trainerId: coach.id },
                            })
                          }
                        />
                      );
                    })}
                  </Card>
                )}
              </>
            );
          }}
        </QueryState>
      ) : (
        <>
          {waiting.length ? (
            <>
              <SectionHeader title="Asked for a trainer" detail={`${waiting.length} waiting`} />
              {waiting.map((request) => (
                <TrainerRequestRow
                  key={request.id}
                  request={request}
                  onPress={() =>
                    router.push({
                      pathname: '/trainer-request/[requestId]',
                      params: { requestId: request.id },
                    })
                  }
                />
              ))}
            </>
          ) : null}
          <SectionHeader title="Members" />
          <TextField
            label="Find a member"
            placeholder="Name or email"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <QueryState query={page}>
            {(data) => {
              const first = data.pages[0];
              const shown = data.pages.flatMap((p) => p.members);
              const loaded = shown.length;
              const total = first.total;
              return (
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chips}>
                    <Chip
                      label={`No trainer ${first.unmatchedCount}`}
                      selected={onlyUnmatched}
                      onPress={() => setOnlyUnmatched(true)}
                    />
                    <Chip
                      label={`All members ${first.membersCount}`}
                      selected={!onlyUnmatched}
                      onPress={() => setOnlyUnmatched(false)}
                    />
                  </ScrollView>
                  {shown.length === 0 ? (
                    <ThemedText themeColor="textSecondary">
                      {onlyUnmatched && !query ? 'Every member has a trainer.' : 'Nobody matches.'}
                    </ThemedText>
                  ) : (
                    <Card>
                      {shown.map(({ person, trainerNames }, i) => (
                        <PersonRow
                          key={person.id}
                          person={person}
                          divider={i > 0}
                          detail={
                            trainerNames.length
                              ? `Trainer: ${trainerNames.join(', ')}`
                              : 'No trainer yet'
                          }
                          hideEmail
                          hideRole
                          onPress={() =>
                            router.push({
                              pathname: '/member-trainers/[memberId]',
                              params: { memberId: person.id },
                            })
                          }
                        />
                      ))}
                    </Card>
                  )}
                  {page.hasNextPage ? (
                    <Button
                      label={`Show more (${loaded} of ${total})`}
                      variant="secondary"
                      loading={page.isFetchingNextPage}
                      onPress={() => page.fetchNextPage()}
                    />
                  ) : null}
                </>
              );
            }}
          </QueryState>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: {
    gap: Spacing.two,
  },
});
