import { router, useLocalSearchParams } from 'expo-router';
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
import { useActiveGym } from '@/features/auth/use-profile';
import {
  useResolveTrainerRequest,
  useTrainerLinks,
  useTrainerRequests,
} from '@/features/coaching/hooks';
import { membersOf, requestStatusLabel, trainersOf } from '@/features/coaching/rules';
import type { TrainerRequest } from '@/features/coaching/types';
import { usePeople } from '@/features/members/hooks';
import { formatDate } from '@/lib/format';

export default function TrainerRequestScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const gym = useActiveGym();
  const requests = useTrainerRequests(gym.gymId);
  const request = requests.data?.find((r) => r.id === requestId);

  if (!request) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">
          {requests.isPending ? 'Loading…' : 'This request is gone.'}
        </ThemedText>
      </Screen>
    );
  }
  return <RequestDetail key={request.id} gymId={gym.gymId} request={request} />;
}

function RequestDetail({ gymId, request }: { gymId: string; request: TrainerRequest }) {
  const people = usePeople(gymId);
  const links = useTrainerLinks(gymId);
  const resolve = useResolveTrainerRequest(gymId);
  const [trainerId, setTrainerId] = useState<string | null>(request.trainerId);
  const [response, setResponse] = useState('');
  const pending = request.status === 'pending';
  const trainers = (people.data ?? []).filter((p) => p.role === 'trainer' && p.status === 'active');
  const current = trainersOf(links.data ?? [], request.memberId);

  return (
    <Screen>
      <Card highlighted={pending}>
        <Pill label={requestStatusLabel[request.status]} tone={pending ? 'warning' : 'neutral'} />
        <ThemedText type="heading">{request.memberName}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Asked {formatDate(request.createdAt)} ·{' '}
          {request.trainerName ? `would like ${request.trainerName}` : 'no trainer preference'}
        </ThemedText>
        <View style={styles.wrap}>
          {request.needs.map((need) => (
            <Pill key={need} label={need} />
          ))}
        </View>
        {request.comments ? <ThemedText type="small">“{request.comments}”</ThemedText> : null}
        <ThemedText type="small" themeColor="textSecondary">
          {current.length
            ? `Trains with ${current.map((l) => l.trainerName).join(', ')} today.`
            : 'No trainer yet.'}
        </ThemedText>
        {request.response ? (
          <ThemedText type="small" themeColor="textSecondary">
            Reply: {request.response}
          </ThemedText>
        ) : null}
      </Card>

      {pending ? (
        <>
          <View style={styles.field}>
            <ThemedText type="label" themeColor="textSecondary">
              Trainer to assign
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}>
              {trainers.map((t) => {
                const load = membersOf(links.data ?? [], t.id).length;
                return (
                  <Chip
                    key={t.id}
                    label={`${t.fullName} · ${load}`}
                    selected={trainerId === t.id}
                    onPress={() => setTrainerId(t.id)}
                  />
                );
              })}
            </ScrollView>
            <ThemedText type="small" themeColor="textSecondary">
              The number is how many members each trainer has now.
            </ThemedText>
          </View>
          <TextField
            label="Note to the member (optional)"
            placeholder="e.g. Divya trains you from Monday, 7 am"
            value={response}
            onChangeText={setResponse}
            multiline
            maxLength={500}
          />
          {resolve.error ? (
            <ThemedText themeColor="danger">{resolve.error.message}</ThemedText>
          ) : null}
          <Button
            label="Approve and assign"
            icon="checkmark"
            disabled={!trainerId}
            loading={resolve.isPending && resolve.variables?.approve === true}
            onPress={() =>
              resolve.mutate(
                { requestId: request.id, approve: true, trainerId, response },
                { onSuccess: () => router.back() },
              )
            }
          />
          <Button
            label="Decline"
            variant="secondary"
            loading={resolve.isPending && resolve.variables?.approve === false}
            onPress={() =>
              resolve.mutate(
                { requestId: request.id, approve: false, trainerId: null, response },
                { onSuccess: () => router.back() },
              )
            }
          />
        </>
      ) : null}
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
    gap: Spacing.one,
  },
  chips: {
    gap: Spacing.two,
  },
});
