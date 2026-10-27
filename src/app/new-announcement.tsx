import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { useSendAnnouncement } from '@/features/announcements/hooks';
import {
  MAX_BODY,
  MAX_TITLE,
  announcementProblem,
  announcementTemplates,
  audiences,
} from '@/features/announcements/rules';
import type { Audience } from '@/features/announcements/types';
import { firstError, validateOptionalText, validateTitle } from '@/lib/validation';

/** Owners and supervisors tell the gym about holidays, timings or offers. */
export default function NewAnnouncementScreen() {
  const profile = useProfile();
  const gym = useActiveGym();
  const send = useSendAnnouncement(gym.gymId, profile.id);
  const [audience, setAudience] = useState<Audience>('everyone');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const problem = firstError(
    announcementProblem({ audience, title, body }),
    validateTitle(title, { label: 'title', max: MAX_TITLE }),
  );
  const chosen = audiences.find((a) => a.value === audience);

  return (
    <Screen refreshable={false}>
      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary">
          Send to
        </ThemedText>
        <View style={styles.wrap}>
          {audiences.map((a) => (
            <Chip
              key={a.value}
              label={a.label}
              selected={audience === a.value}
              onPress={() => setAudience(a.value)}
            />
          ))}
        </View>
        {chosen ? (
          <ThemedText type="small" themeColor="textSecondary">
            {chosen.detail}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary">
          About
        </ThemedText>
        <View style={styles.wrap}>
          {announcementTemplates.map((t) => (
            <Chip key={t} label={t} selected={title === t} onPress={() => setTitle(t)} />
          ))}
        </View>
      </View>
      <TextField
        label="Title"
        placeholder="e.g. Gym closed on Diwali"
        value={title}
        onChangeText={setTitle}
        maxLength={MAX_TITLE}
        error={title ? validateTitle(title, { label: 'title', max: MAX_TITLE }) : null}
      />
      <TextField
        label="Message"
        placeholder="e.g. We're closed on 1 Nov and open as usual from 2 Nov, 5 am."
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={MAX_BODY}
        error={validateOptionalText(body, MAX_BODY)}
      />

      {send.error ? <ThemedText themeColor="danger">{send.error.message}</ThemedText> : null}
      <Button
        label="Send announcement"
        icon="send-outline"
        disabled={!!problem}
        loading={send.isPending}
        onPress={() => send.mutate({ audience, title, body }, { onSuccess: () => router.back() })}
      />
      <ThemedText type="small" themeColor="textSecondary">
        Everyone it’s for gets a push notification, and it stays on the gym’s announcements list.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
