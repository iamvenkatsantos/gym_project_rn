import { router } from 'expo-router';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { useActiveGym } from '@/features/auth/use-profile';
import { CoachedMembers } from '@/features/members/components/coached-members';
import { PendingInvites } from '@/features/members/components/pending-invites';

export default function TrainerMembersScreen() {
  const gym = useActiveGym();
  return (
    <Screen>
      {/* Trainers invite members to their own branch; whoever they invite becomes their member. */}
      <Button
        label="Invite a member"
        icon="person-add-outline"
        onPress={() => router.push('/invite-person')}
      />
      <PendingInvites gymId={gym.gymId} canWithdraw={() => true} />
      <CoachedMembers />
    </Screen>
  );
}
