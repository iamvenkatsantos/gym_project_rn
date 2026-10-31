import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import {
  useDeleteSavedOffer,
  useSaveOffer,
  useSavedOffers,
  useSendAnnouncement,
} from '@/features/announcements/hooks';
import {
  MAX_BODY,
  MAX_TITLE,
  announcementProblem,
  announcementTemplates,
  audiences,
  isAudience,
} from '@/features/announcements/rules';
import type { Audience } from '@/features/announcements/types';
import { firstError, validateOptionalText, validateTitle } from '@/lib/validation';

/**
 * Owners and supervisors tell the gym about holidays, timings or offers. Offers
 * can be saved once and posted again. The plan editor opens it filled in.
 */
export default function NewAnnouncementScreen() {
  const params = useLocalSearchParams<{ title?: string; body?: string; audience?: string }>();
  const profile = useProfile();
  const gym = useActiveGym();
  const send = useSendAnnouncement(gym.gymId, profile.id);
  const saved = useSavedOffers(gym.gymId).data ?? [];
  const keepOffer = useSaveOffer(gym.gymId, profile.id);
  const removeOffer = useDeleteSavedOffer(gym.gymId);
  const [audience, setAudience] = useState<Audience>(
    isAudience(params.audience) ? params.audience : 'everyone',
  );
  const [title, setTitle] = useState(params.title ?? '');
  const [body, setBody] = useState(params.body ?? '');
  const [keep, setKeep] = useState(false);
  const picked = saved.find((o) => o.title === title.trim() && o.body === body.trim());
  const sending = send.isPending || keepOffer.isPending;

  const sendNow = async () => {
    const input = { audience, title, body };
    try {
      if (keep && !picked) await keepOffer.mutateAsync(input);
      await send.mutateAsync(input);
      router.back();
    } catch {
      // The error shows under the form.
    }
  };
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

      {saved.length > 0 ? (
        <View style={styles.field}>
          <ThemedText type="label" themeColor="textSecondary">
            Saved offers
          </ThemedText>
          <View style={styles.wrap}>
            {saved.map((o) => (
              <Chip
                key={o.id}
                label={o.title}
                selected={picked?.id === o.id}
                onPress={() => {
                  setAudience(o.audience);
                  setTitle(o.title);
                  setBody(o.body);
                }}
              />
            ))}
          </View>
          {picked ? (
            <View style={styles.wrap}>
              <Button
                label="Remove from saved"
                icon="trash-outline"
                variant="secondary"
                size="compact"
                loading={removeOffer.isPending}
                onPress={() => removeOffer.mutate(picked.id)}
              />
            </View>
          ) : null}
        </View>
      ) : null}

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

      {picked ? null : (
        <View style={styles.wrap}>
          <Chip
            label="Save as an offer to reuse"
            selected={keep}
            onPress={() => setKeep((k) => !k)}
          />
        </View>
      )}

      {send.error || keepOffer.error ? (
        <ThemedText themeColor="danger">{(send.error ?? keepOffer.error)?.message}</ThemedText>
      ) : null}
      <Button
        label="Send announcement"
        icon="send-outline"
        disabled={!!problem}
        loading={sending}
        onPress={sendNow}
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
