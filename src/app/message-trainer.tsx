import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { ClassRow } from '@/features/bookings/components/class-row';
import { useUpcomingClasses } from '@/features/bookings/hooks';
import { usePeople } from '@/features/members/hooks';
import { activeCoaches, coachLabel } from '@/features/members/rules';
import { useMessageTrainer } from '@/features/notifications/hooks';
import {
  MAX_BODY,
  MAX_TITLE,
  messageProblem,
  messageTemplates,
} from '@/features/notifications/rules';
import { firstError, validateOptionalText, validateTitle } from '@/lib/validation';

/** Owners and supervisors nudge a trainer to schedule a class or follow up on one. */
export default function MessageTrainerScreen() {
  const params = useLocalSearchParams<{ trainerId?: string; classId?: string }>();
  const profile = useProfile();
  const gym = useActiveGym();
  const people = usePeople(gym.gymId);
  const classes = useUpcomingClasses(gym.gymId);
  const send = useMessageTrainer(gym.gymId, profile.id);
  const gymClass = classes.data?.find((c) => c.id === params.classId);
  const [trainerId, setTrainerId] = useState(params.trainerId ?? '');
  const [title, setTitle] = useState<string>(
    params.classId ? messageTemplates[1] : messageTemplates[0],
  );
  const [body, setBody] = useState('');
  // Any other coach, so a supervisor can reach an owner who teaches and vice versa.
  const trainers = activeCoaches(people.data ?? []).filter((p) => p.id !== profile.id);
  const problem = firstError(
    messageProblem({ trainerId, title, body }),
    validateTitle(title, { label: 'subject', max: MAX_TITLE }),
  );

  return (
    <Screen refreshable={false}>
      {gymClass ? <ClassRow gymClass={gymClass} showDay /> : null}

      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary">
          Trainer
        </ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}>
          {trainers.map((t) => (
            <Chip
              key={t.id}
              label={coachLabel(t)}
              selected={trainerId === t.id}
              onPress={() => setTrainerId(t.id)}
            />
          ))}
        </ScrollView>
        {people.data && trainers.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No trainers at this gym yet.
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary">
          About
        </ThemedText>
        <View style={styles.wrap}>
          {messageTemplates.map((t) => (
            <Chip key={t} label={t} selected={title === t} onPress={() => setTitle(t)} />
          ))}
        </View>
      </View>
      <TextField
        label="Subject"
        value={title}
        onChangeText={setTitle}
        maxLength={MAX_TITLE}
        error={validateTitle(title, { label: 'subject', max: MAX_TITLE })}
      />
      <TextField
        label="Message"
        placeholder="e.g. Members are asking for a Saturday 8 am strength class."
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={MAX_BODY}
        error={validateOptionalText(body, MAX_BODY)}
      />

      {send.error ? <ThemedText themeColor="danger">{send.error.message}</ThemedText> : null}
      <Button
        label="Send to trainer"
        icon="send-outline"
        disabled={!!problem}
        loading={send.isPending}
        onPress={() =>
          send.mutate(
            { trainerId, title, body, classId: gymClass?.id ?? null },
            { onSuccess: () => router.back() },
          )
        }
      />
      <ThemedText type="small" themeColor="textSecondary">
        It lands in the trainer’s inbox in the app.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two,
  },
  chips: {
    gap: Spacing.two,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
