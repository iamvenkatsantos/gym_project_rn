import { router } from 'expo-router';

import { ShortcutGrid } from '@/components/shortcut-grid';
import { Screen } from '@/components/screen';
import { LatestAnnouncement } from '@/features/announcements/components/latest-announcement';
import { CheckInCard } from '@/features/attendance/components/check-in-card';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { useGymReferrals } from '@/features/referrals/hooks';
import { CoachSchedule } from '@/features/trainers/components/coach-schedule';
import { PlanBanner } from '@/features/subscription/components/plan-banner';

export default function TrainerScheduleScreen() {
  const profile = useProfile();
  const gym = useActiveGym();
  const referrals = useGymReferrals(gym.gymId);

  return (
    <Screen>
      <PlanBanner />
      <CheckInCard gymId={gym.gymId} userId={profile.id} role="trainer" />
      <ShortcutGrid
        shortcuts={[
          {
            label: 'Permission',
            icon: 'time-outline',
            onPress: () => router.push('/permissions'),
          },
          {
            label: 'Referrals',
            icon: 'person-add-outline',
            badge: referrals.data?.filter((r) => r.status === 'pending').length,
            onPress: () => router.push('/referrals'),
          },
        ]}
      />
      <LatestAnnouncement />
      <CoachSchedule />
    </Screen>
  );
}
