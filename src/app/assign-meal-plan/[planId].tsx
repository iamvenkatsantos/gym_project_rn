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
import { canManageGym } from '@/features/auth/types';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { assignableMembers } from '@/features/coaching/rules';
import { useAssignMealPlan, useMealPlans } from '@/features/diet/hooks';
import { otherPlanOf } from '@/features/diet/rules';
import { useCoachedMembers, usePeople } from '@/features/members/hooks';
import { initials } from '@/features/trainers/rules';
import { useTheme } from '@/hooks/use-theme';

export default function AssignMealPlanScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const theme = useTheme();
  const profile = useProfile();
  const gym = useActiveGym();
  const plans = useMealPlans(gym.gymId, profile.id);
  const plan = plans.data?.find((p) => p.id === planId);
  // Owners and supervisors can coach anyone; trainers only their mapped members.
  const manager = canManageGym(gym.role);
  const members = useCoachedMembers(gym.gymId, profile.id);
  const people = usePeople(gym.gymId, { enabled: manager });
  const assign = useAssignMealPlan(gym.gymId, profile.id);
  const [query, setQuery] = useState('');

  if (!plan) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">
          {plans.isPending ? 'Loading…' : 'Plan not found.'}
        </ThemedText>
      </Screen>
    );
  }

  return (
    <Screen>
      <View>
        <ThemedText type="label" themeColor="accent">
          Assign diet plan
        </ThemedText>
        <ThemedText type="title">{plan.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          A member follows one diet plan at a time, so this replaces the one they have.{' '}
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
      <SectionHeader title="Members" detail={`${plan.assignedMemberIds.length} on this plan`} />
      <QueryState
        query={members}
        isEmpty={(list) => !manager && list.length === 0}
        emptyText="No members matched with you yet. Ask the owner or a supervisor to assign some.">
        {(list) => {
          const q = query.trim().toLowerCase();
          const matches = assignableMembers(list, manager ? people.data : []).filter((m) =>
            m.fullName.toLowerCase().includes(q),
          );
          if (matches.length === 0) {
            return <ThemedText themeColor="textSecondary">No members match.</ThemedText>;
          }
          return (
            <Card>
              {matches.map((member, i) => {
                const assigned = plan.assignedMemberIds.includes(member.id);
                const saving = assign.isPending && assign.variables?.memberId === member.id;
                const other = assigned ? null : otherPlanOf(plans.data ?? [], member.id);
                const hint = !member.coached
                  ? 'Not your member yet'
                  : other
                    ? `On ${other.title}`
                    : null;
                return (
                  <Pressable
                    key={member.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: assigned, busy: saving }}
                    accessibilityLabel={member.fullName}
                    accessibilityHint={hint ?? undefined}
                    disabled={saving}
                    onPress={() =>
                      assign.mutate({
                        planId: plan.id,
                        memberId: member.id,
                        assigned: !assigned,
                        mapFirst: !member.coached,
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
                    <View style={styles.name}>
                      <ThemedText type="smallBold">{member.fullName}</ThemedText>
                      {hint ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          {hint}
                        </ThemedText>
                      ) : null}
                    </View>
                    {saving ? (
                      <ActivityIndicator color={theme.accent} />
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
