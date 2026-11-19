import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { HeaderDoneButton } from '@/components/navigation/header-done-button';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { canManageGym } from '@/features/auth/types';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { useAssignPlan } from '@/features/coaching/hooks';
import { assignableMembers } from '@/features/coaching/rules';
import { useCoachedMembers, useDebounced, useMatchMembersPage } from '@/features/members/hooks';
import { initials } from '@/features/trainers/rules';
import { DayPicker } from '@/features/workouts/components/day-picker';
import { useSetAssignmentDays, useWorkout } from '@/features/workouts/hooks';
import { daysLabel } from '@/features/workouts/schedule';
import { useTheme } from '@/hooks/use-theme';

export default function AssignPlanScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const theme = useTheme();
  const profile = useProfile();
  const gym = useActiveGym();
  const { workout, isPending } = useWorkout(gym.gymId, profile.id, workoutId);
  // Owners and supervisors can coach anyone; trainers only their mapped members.
  const manager = canManageGym(gym.role);
  const members = useCoachedMembers(gym.gymId, profile.id);
  const [query, setQuery] = useState('');
  // Owners and supervisors also see members they don't coach yet: a page at a time from the
  // server (searched there), instead of the whole people list.
  const others = useMatchMembersPage(gym.gymId, false, useDebounced(query), { enabled: manager });
  const otherPeople = others.data?.pages.flatMap((page) => page.members.map((m) => m.person)) ?? [];
  const assign = useAssignPlan(gym.gymId, profile.id);
  const setDays = useSetAssignmentDays();

  if (!workout) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">
          {isPending ? 'Loading…' : 'Plan not found.'}
        </ThemedText>
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Picks save on tap, so the header tick only closes the screen; it shows the count. */}
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderDoneButton
              count={workout.assignedMemberIds.length}
              disabled={assign.isPending || setDays.isPending}
            />
          ),
        }}
      />
      <View>
        <ThemedText type="label" themeColor="accent">
          Assign plan
        </ThemedText>
        <ThemedText type="title">{workout.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Pick each member&apos;s days, or none for any day.{' '}
          {manager
            ? 'Assigning someone you don’t coach yet also makes you their trainer.'
            : 'You can assign it to the members your gym matched with you.'}
        </ThemedText>
      </View>
      <TextField
        label="Find a member"
        placeholder="Search by name"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
      />
      <SectionHeader title="Members" detail={`${workout.assignedMemberIds.length} assigned`} />
      <QueryState
        query={members}
        isEmpty={(list) => !manager && list.length === 0}
        emptyText="No members matched with you yet. Ask the owner or a supervisor to assign some.">
        {(list) => {
          const q = query.trim().toLowerCase();
          const matches = assignableMembers(list, manager ? otherPeople : []).filter((m) =>
            m.fullName.toLowerCase().includes(q),
          );
          if (matches.length === 0) {
            return <ThemedText themeColor="textSecondary">No members match.</ThemedText>;
          }
          return (
            <Card>
              {matches.map((member, i) => {
                const assigned = workout.assignedMemberIds.includes(member.id);
                const saving = assign.isPending && assign.variables?.memberId === member.id;
                const days = workout.memberDays[member.id] ?? [];
                return (
                  <View
                    key={member.id}
                    style={[
                      styles.member,
                      i > 0 && {
                        borderTopColor: theme.border,
                        borderTopWidth: StyleSheet.hairlineWidth,
                      },
                    ]}>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: assigned, busy: saving }}
                      accessibilityLabel={member.fullName}
                      disabled={saving}
                      onPress={() =>
                        assign.mutate({
                          workoutId: workout.id,
                          memberId: member.id,
                          assigned: !assigned,
                          mapFirst: !member.coached,
                        })
                      }
                      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                      <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
                        <ThemedText type="smallBold">{initials(member.fullName)}</ThemedText>
                      </View>
                      <View style={styles.name}>
                        <ThemedText type="smallBold">{member.fullName}</ThemedText>
                        {member.coached ? (
                          assigned ? (
                            <ThemedText type="small" themeColor="textSecondary">
                              {daysLabel(days)}
                            </ThemedText>
                          ) : null
                        ) : (
                          <ThemedText type="small" themeColor="textSecondary">
                            Not your member yet
                          </ThemedText>
                        )}
                      </View>
                      {/* The tick changes on tap; it's dimmed until the server has it. */}
                      <View
                        style={[
                          styles.check,
                          assigned
                            ? { backgroundColor: theme.primary }
                            : { borderColor: theme.border, borderWidth: 2 },
                          saving && styles.saving,
                        ]}>
                        {assigned ? <Icon name="checkmark" size={18} color="onPrimary" /> : null}
                      </View>
                    </Pressable>
                    {assigned ? (
                      <DayPicker
                        label={`${member.fullName}'s days`}
                        days={days}
                        disabled={setDays.isPending && setDays.variables?.memberId === member.id}
                        onChange={(next) =>
                          setDays.mutate({ workoutId: workout.id, memberId: member.id, days: next })
                        }
                      />
                    ) : null}
                  </View>
                );
              })}
            </Card>
          );
        }}
      </QueryState>
      {manager && others.hasNextPage ? (
        <Button
          label="Show more"
          variant="secondary"
          loading={others.isFetchingNextPage}
          onPress={() => others.fetchNextPage()}
        />
      ) : null}
      {assign.error || setDays.error ? (
        <ThemedText themeColor="danger">
          Couldn&apos;t update: {(assign.error ?? setDays.error)?.message}
        </ThemedText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  member: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: TapTarget + 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flex: 1,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  saving: {
    opacity: 0.6,
  },
});
