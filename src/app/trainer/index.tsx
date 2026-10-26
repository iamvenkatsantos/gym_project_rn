import { Screen } from '@/components/screen';
import { LatestAnnouncement } from '@/features/announcements/components/latest-announcement';
import { CheckInCard } from '@/features/attendance/components/check-in-card';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { CoachSchedule } from '@/features/trainers/components/coach-schedule';

export default function TrainerScheduleScreen() {
  const profile = useProfile();
  const gym = useActiveGym();

  return (
    <Screen>
      <CheckInCard gymId={gym.gymId} userId={profile.id} role="trainer" />
      <LatestAnnouncement />
      <CoachSchedule />
    </Screen>
  );
}
