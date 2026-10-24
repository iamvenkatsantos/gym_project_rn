import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Pill } from '@/components/pill';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import {
  useRequestTrainer,
  useTrainerLinks,
  useTrainerRequests,
  useWithdrawTrainerRequest,
} from '@/features/coaching/hooks';
import {
  MAX_COMMENTS,
  openRequest,
  requestProblem,
  toggle,
  trainerNeeds,
} from '@/features/coaching/rules';
import { useGymMembers } from '@/features/members/hooks';
import { formatDate } from '@/lib/format';
import { validateOptionalText } from '@/lib/validation';

export default function RequestTrainerScreen() {
  const profile = useProfile();
  const gym = useActiveGym();
  const requests = useTrainerRequests(gym.gymId);
  const pending = requests.data ? openRequest(requests.data, profile.id) : null;

  if (requests.isPending) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      </Screen>
    );
  }
  if (pending) return <PendingRequest requestId={pending.id} />;
  return <RequestForm gymId={gym.gymId} memberId={profile.id} />;
}

function PendingRequest({ requestId }: { requestId: string }) {
  const gym = useActiveGym();
  const requests = useTrainerRequests(gym.gymId);
  const withdraw = useWithdrawTrainerRequest();
  const request = requests.data?.find((r) => r.id === requestId);
  if (!request) return null;

  return (
    <Screen>
      <Card highlighted>
        <Pill label="Waiting for the gym" tone="warning" icon="time-outline" />
        <ThemedText type="heading">
          {request.trainerName ? `You asked for ${request.trainerName}` : 'You asked for a trainer'}
        </ThemedText>
        <View style={styles.needs}>
          {request.needs.map((need) => (
            <Pill key={need} label={need} />
          ))}
        </View>
        {request.comments ? (
          <ThemedText type="small" themeColor="textSecondary">
            “{request.comments}”
          </ThemedText>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary">
          Sent {formatDate(request.createdAt)}. Your gym will match you with a trainer and you’ll
          get a message in your inbox.
        </ThemedText>
      </Card>
      {withdraw.error ? (
        <ThemedText themeColor="danger">{withdraw.error.message}</ThemedText>
      ) : null}
      <Button
        label="Withdraw request"
        variant="secondary"
        loading={withdraw.isPending}
        onPress={() => withdraw.mutate(request.id)}
      />
    </Screen>
  );
}

function RequestForm({ gymId, memberId }: { gymId: string; memberId: string }) {
  const trainers = useGymMembers(gymId, 'trainer');
  const links = useTrainerLinks(gymId, { memberId });
  const request = useRequestTrainer(gymId, memberId);
  const [needs, setNeeds] = useState<string[]>([]);
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [comments, setComments] = useState('');
  const input = { trainerId, needs, comments };
  const problem = requestProblem(input);
  const current = new Set(links.data?.map((l) => l.trainerId));
  const choices = (trainers.data ?? []).filter((t) => !current.has(t.id));

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        Tell your gym what you’d like help with. A supervisor or the owner will match you with a
        trainer.
      </ThemedText>

      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary">
          What do you need?
        </ThemedText>
        <View style={styles.needs}>
          {trainerNeeds.map((need) => (
            <Chip
              key={need}
              label={need}
              selected={needs.includes(need)}
              onPress={() => setNeeds(toggle(needs, need))}
            />
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary">
          Trainer you’d like (optional)
        </ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}>
          <Chip
            label="No preference"
            selected={trainerId === null}
            onPress={() => setTrainerId(null)}
          />
          {choices.map((t) => (
            <Chip
              key={t.id}
              label={t.fullName}
              selected={trainerId === t.id}
              onPress={() => setTrainerId(t.id)}
            />
          ))}
        </ScrollView>
      </View>

      <TextField
        label="Comments"
        placeholder="Goals, injuries, times that suit you…"
        value={comments}
        onChangeText={setComments}
        multiline
        maxLength={MAX_COMMENTS}
        error={validateOptionalText(comments, MAX_COMMENTS)}
      />

      {request.error ? <ThemedText themeColor="danger">{request.error.message}</ThemedText> : null}
      <Button
        label="Send request"
        icon="send-outline"
        disabled={!!problem}
        loading={request.isPending}
        onPress={() => request.mutate(input, { onSuccess: () => router.back() })}
      />
      {problem ? (
        <ThemedText type="small" themeColor="textSecondary">
          {problem}
        </ThemedText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two,
  },
  needs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chips: {
    gap: Spacing.two,
  },
});
