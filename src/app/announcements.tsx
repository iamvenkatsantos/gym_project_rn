import { router } from 'expo-router';
import { Alert } from 'react-native';

import { Button } from '@/components/button';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { canManageGym } from '@/features/auth/types';
import { useActiveGym } from '@/features/auth/use-profile';
import { AnnouncementCard } from '@/features/announcements/components/announcement-card';
import { useAnnouncements, useDeleteAnnouncement } from '@/features/announcements/hooks';
import type { Announcement } from '@/features/announcements/types';

/** Everything the gym announced to this person. Owners and supervisors post and take them down here. */
export default function AnnouncementsScreen() {
  const gym = useActiveGym();
  const manages = canManageGym(gym.role);
  const announcements = useAnnouncements(gym.gymId, gym.role);
  const remove = useDeleteAnnouncement();

  const confirmRemove = (a: Announcement) =>
    Alert.alert('Remove announcement?', 'It comes off this list. Inbox copies already sent stay.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(a.id) },
    ]);

  return (
    <Screen>
      {manages ? (
        <Button
          label="New announcement"
          icon="megaphone-outline"
          onPress={() => router.push('/new-announcement')}
        />
      ) : null}
      {remove.error ? <ThemedText themeColor="danger">{remove.error.message}</ThemedText> : null}
      <QueryState
        query={announcements}
        isEmpty={(list) => list.length === 0}
        emptyText={
          manages
            ? 'Nothing announced yet. Tell everyone about holidays, new timings or offers.'
            : 'No announcements from your gym yet.'
        }>
        {(list) =>
          list.map((a) => (
            <AnnouncementCard
              key={a.id}
              announcement={a}
              showAudience={manages}
              onRemove={manages ? () => confirmRemove(a) : undefined}
            />
          ))
        }
      </QueryState>
    </Screen>
  );
}
