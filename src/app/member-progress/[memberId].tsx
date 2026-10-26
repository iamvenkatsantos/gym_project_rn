import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { BodyProgress } from '@/features/body/components/body-progress';
import { useCoachedMembers } from '@/features/members/hooks';
import { ProgressOverview } from '@/features/progress/components/progress-overview';
import { useWorkoutLogs } from '@/features/progress/hooks';

type Tab = 'workouts' | 'body';

/**
 * Someone's workouts, measurements and progress photos as their trainer, supervisor or
 * owner sees them. The database only shares these along that hierarchy
 * (can_view_workout_logs). Read only: members log their own.
 */
export default function MemberProgressScreen() {
  const { memberId, name } = useLocalSearchParams<{ memberId: string; name?: string }>();
  const profile = useProfile();
  const gym = useActiveGym();
  // Only trainers have coached members; for managers this comes back empty.
  const coached = useCoachedMembers(gym.gymId, profile.id);
  const logs = useWorkoutLogs(gym.gymId, memberId);
  const member = coached.data?.find((m) => m.id === memberId);
  const [tab, setTab] = useState<Tab>('workouts');

  return (
    <Screen>
      <Stack.Screen options={{ title: member?.fullName ?? name ?? 'Member' }} />
      {member ? (
        <View>
          <ThemedText type="title">{member.fullName}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            On {member.plans.join(', ')}
          </ThemedText>
        </View>
      ) : name ? (
        <ThemedText type="title">{name}</ThemedText>
      ) : null}
      <SegmentedControl<Tab>
        options={[
          { value: 'workouts', label: 'Workouts' },
          { value: 'body', label: 'Body' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'workouts' ? (
        <QueryState
          query={logs}
          isEmpty={(list) => list.length === 0}
          emptyText="No workouts logged yet.">
          {(list) => <ProgressOverview logs={list} />}
        </QueryState>
      ) : (
        <BodyProgress gymId={gym.gymId} memberId={memberId} editable={false} />
      )}
    </Screen>
  );
}
