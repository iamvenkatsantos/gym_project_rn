import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { useCoachedMembers } from '@/features/members/hooks';
import { ProgressOverview } from '@/features/progress/components/progress-overview';
import { useWorkoutLogs } from '@/features/progress/hooks';

/** A trainer's view of a member they coach. The database only shares logs with assigned trainers. */
export default function MemberProgressForTrainerScreen() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const profile = useProfile();
  const gym = useActiveGym();
  const coached = useCoachedMembers(gym.gymId, profile.id);
  const logs = useWorkoutLogs(gym.gymId, memberId);
  const member = coached.data?.find((m) => m.id === memberId);

  return (
    <Screen>
      <Stack.Screen options={{ title: member?.fullName ?? 'Member' }} />
      {member ? (
        <View>
          <ThemedText type="title">{member.fullName}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            On {member.plans.join(', ')}
          </ThemedText>
        </View>
      ) : null}
      <QueryState
        query={logs}
        isEmpty={(list) => list.length === 0}
        emptyText="No workouts logged yet.">
        {(list) => <ProgressOverview logs={list} />}
      </QueryState>
    </Screen>
  );
}
