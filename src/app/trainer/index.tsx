import { router } from 'expo-router';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { LatestAnnouncement } from '@/features/announcements/components/latest-announcement';
import { CheckInCard } from '@/features/attendance/components/check-in-card';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { CoachSchedule } from '@/features/trainers/components/coach-schedule';
import { PlanBanner } from '@/features/subscription/components/plan-banner';

export default function TrainerScheduleScreen() {
  const profile = useProfile();
  const gym = useActiveGym();

  return (
    <Screen>
      <PlanBanner />
      <CheckInCard gymId={gym.gymId} userId={profile.id} role="trainer" />
      <Button
        label="Ask for permission"
        icon="time-outline"
        variant="secondary"
        onPress={() => router.push('/permissions')}
      />
      <LatestAnnouncement />
      <CoachSchedule />
    </Screen>
  );
}
