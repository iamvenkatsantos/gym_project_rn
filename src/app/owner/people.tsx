import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Icon } from '@/components/icon';
import { Pill } from '@/components/pill';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing, TapTarget } from '@/constants/theme';
import { useActiveGym } from '@/features/auth/use-profile';
import { PersonRow, roleTone } from '@/features/members/components/person-row';
import { useInvites, usePeople, useWithdrawInvite } from '@/features/members/hooks';
import { countPeople, filterPeople } from '@/features/members/rules';
import type { PeopleFilter } from '@/features/members/types';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/format';

const filters: { value: PeopleFilter; label: string }[] = [
  { value: 'all', label: 'Everyone' },
  { value: 'member', label: 'Members' },
  { value: 'trainer', label: 'Trainers' },
  { value: 'owner', label: 'Owners' },
  { value: 'suspended', label: 'Suspended' },
];

export default function OwnerPeopleScreen() {
  const theme = useTheme();
  const gym = useActiveGym();
  const people = usePeople(gym.gymId);
  const invites = useInvites(gym.gymId);
  const withdraw = useWithdrawInvite();
  const [filter, setFilter] = useState<PeopleFilter>('all');
  const [query, setQuery] = useState('');

  return (
    <Screen>
      <Button
        label="Invite someone"
        icon="person-add-outline"
        onPress={() => router.push('/invite-person')}
      />

      {invites.data?.length ? (
        <>
          <SectionHeader title="Pending invites" detail={`${invites.data.length}`} />
          <Card>
            {invites.data.map((invite, i) => (
              <View
                key={invite.id}
                style={[
                  styles.invite,
                  i > 0 && {
                    borderTopColor: theme.border,
                    borderTopWidth: StyleSheet.hairlineWidth,
                  },
                ]}>
                <Icon name="mail-outline" size={20} />
                <View style={styles.flex}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {invite.email}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Invited {formatDate(invite.createdAt)} · waiting for sign-up
                  </ThemedText>
                </View>
                <Pill label={invite.role} tone={roleTone[invite.role]} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Withdraw invite for ${invite.email}`}
                  hitSlop={8}
                  disabled={withdraw.isPending}
                  onPress={() => withdraw.mutate(invite.id)}>
                  <Icon name="close-circle" size={22} />
                </Pressable>
              </View>
            ))}
          </Card>
        </>
      ) : null}

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

const styles = StyleSheet.create({
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: TapTarget + 8,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  chips: {
    gap: Spacing.two,
  },
});
