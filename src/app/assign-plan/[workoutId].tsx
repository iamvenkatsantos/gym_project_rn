import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { useCoachedMembers } from '@/features/members/hooks';
import { initials } from '@/features/trainers/rules';
import { useSetAssignment, useWorkout } from '@/features/workouts/hooks';
import { useTheme } from '@/hooks/use-theme';

export default function AssignPlanScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const theme = useTheme();
  const profile = useProfile();
  const gym = useActiveGym();
  const { workout, isPending } = useWorkout(gym.gymId, profile.id, workoutId);
  const members = useCoachedMembers(gym.gymId, profile.id);
  const assign = useSetAssignment();
  const [query, setQuery] = useState('');

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
      <View>
        <ThemedText type="label" themeColor="primary">
          Assign plan
        </ThemedText>
        <ThemedText type="title">{workout.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Members you assign see this plan first. You can assign it to the members your gym matched
          with you.
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
        isEmpty={(list) => list.length === 0}
        emptyText="No members matched with you yet. Ask the owner or a supervisor to assign some.">
        {(list) => {
          const q = query.trim().toLowerCase();
          const matches = list.filter((m) => m.fullName.toLowerCase().includes(q));
          if (matches.length === 0) {
            return <ThemedText themeColor="textSecondary">No members match.</ThemedText>;
          }
          return (
            <Card>
              {matches.map((member, i) => {
                const assigned = workout.assignedMemberIds.includes(member.id);
                const saving = assign.isPending && assign.variables?.memberId === member.id;
                return (
                  <Pressable
                    key={member.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: assigned, busy: saving }}
                    accessibilityLabel={member.fullName}
                    disabled={saving}
                    onPress={() =>
                      assign.mutate({
                        workoutId: workout.id,
                        memberId: member.id,
                        assigned: !assigned,
                      })
                    }
                    style={({ pressed }) => [
                      styles.row,
                      i > 0 && {
                        borderTopColor: theme.border,
                        borderTopWidth: StyleSheet.hairlineWidth,
                      },
                      pressed && styles.pressed,
                    ]}>
                    <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
                      <ThemedText type="smallBold">{initials(member.fullName)}</ThemedText>
                    </View>
                    <ThemedText type="smallBold" style={styles.name}>
                      {member.fullName}
                    </ThemedText>
                    {saving ? (
                      <ActivityIndicator color={theme.primary} />
                    ) : (
                      <View
                        style={[
                          styles.check,
                          assigned
                            ? { backgroundColor: theme.primary }
                            : { borderColor: theme.border, borderWidth: 2 },
                        ]}>
                        {assigned ? <Icon name="checkmark" size={18} color="onPrimary" /> : null}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </Card>
          );
        }}
      </QueryState>
      {assign.error ? (
        <ThemedText themeColor="danger">Couldn&apos;t update: {assign.error.message}</ThemedText>
      ) : null}
      <Button label="Done" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
});
