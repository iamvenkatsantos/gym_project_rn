import { router } from 'expo-router';

import { SectionHeader } from '@/components/section-header';
import { useActiveGym } from '@/features/auth/use-profile';
import { AnnouncementCard } from '@/features/announcements/components/announcement-card';
import { useAnnouncements } from '@/features/announcements/hooks';
import { latestRecent } from '@/features/announcements/rules';

/** The gym's newest announcement from this week on the home screen. Hidden when there's none. */
export function LatestAnnouncement() {
  const gym = useActiveGym();
  const announcements = useAnnouncements(gym.gymId, gym.role);
  const latest = announcements.data ? latestRecent(announcements.data) : null;
  if (!latest) return null;

  return (
    <>
      <SectionHeader title="From your gym" />
      <AnnouncementCard
        announcement={latest}
        highlighted
        onPress={() => router.push('/announcements')}
      />
    </>
  );
}
