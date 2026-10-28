import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

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
import {
  membersOf,
  membersToMatch,
  pendingRequests,
  trainerSummary,
  trainersOf,
} from '@/features/coaching/rules';
import { PersonRow } from '@/features/members/components/person-row';
import { usePeople } from '@/features/members/hooks';
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
  const people = usePeople(gym.gymId);
  const links = useTrainerLinks(gym.gymId);
  const requests = useTrainerRequests(gym.gymId);
  const [tab, setTab] = useState<Tab>(params.tab === 'trainers' ? 'trainers' : 'members');
  const [onlyUnmatched, setOnlyUnmatched] = useState(true);
  const [query, setQuery] = useState('');
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

      <QueryState query={people}>
        {(list) => {
          const allLinks = links.data ?? [];
          if (tab === 'trainers') {
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
          }

          const members = membersToMatch(list, allLinks, query);
          const unmatched = members.filter((m) => trainersOf(allLinks, m.id).length === 0);
          const shown = onlyUnmatched ? unmatched : members;
          return (
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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}>
                <Chip
                  label={`No trainer ${unmatched.length}`}
                  selected={onlyUnmatched}
                  onPress={() => setOnlyUnmatched(true)}
                />
                <Chip
                  label={`All members ${members.length}`}
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
                  {shown.map((member, i) => (
                    <PersonRow
                      key={member.id}
                      person={member}
                      divider={i > 0}
                      detail={trainerSummary(allLinks, member.id)}
                      hideEmail
                      hideRole
                      onPress={() =>
                        router.push({
                          pathname: '/member-trainers/[memberId]',
                          params: { memberId: member.id },
                        })
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

const styles = StyleSheet.create({
  chips: {
    gap: Spacing.two,
  },
});
