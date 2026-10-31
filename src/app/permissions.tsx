import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { Stepper } from '@/components/stepper';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { dayLabel } from '@/features/attendance/rules';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { timeOfDay } from '@/features/check-in/rules';
import { addDays, toIsoDate } from '@/features/memberships/rules';
import { PermissionCard } from '@/features/trainer-hours/components/permission-card';
import {
  useCancelPermission,
  usePermissions,
  useRequestPermission,
} from '@/features/trainer-hours/hooks';
import {
  MAX_NOTE,
  permissionProblem,
  permissionReasons,
  sortPermissions,
} from '@/features/trainer-hours/rules';
import type { PermissionReason } from '@/features/trainer-hours/types';

const LAST_MINUTE = 23 * 60 + 30;

/** Trainers ask the owner for time off during working hours and see the answers. */
export default function PermissionsScreen() {
  const gym = useActiveGym();
  const profile = useProfile();
  const mine = usePermissions(gym.gymId, profile.id);
  const ask = useRequestPermission(gym.gymId, profile);
  const cancel = useCancelPermission();

  const today = toIsoDate(new Date());
  const [offset, setOffset] = useState(0);
  const [startsAt, setStartsAt] = useState(10 * 60);
  const [endsAt, setEndsAt] = useState(12 * 60);
  const [reason, setReason] = useState<PermissionReason | null>(null);
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);

  const day = addDays(today, offset);
  const problem = reason
    ? permissionProblem({ day, startsAt, endsAt, reason, note })
    : 'Pick a reason.';

  const submit = () => {
    setTried(true);
    if (problem || !reason) return;
    ask.mutate(
      { day, startsAt, endsAt, reason, note },
      {
        onSuccess: () => {
          setReason(null);
          setNote('');
          setTried(false);
        },
      },
    );
  };

  return (
    <Screen refreshable={false}>
      <SectionHeader title="Ask for permission" />
      <Card>
        <Stepper
          label="Day"
          value={offset}
          min={-7}
          max={60}
          format={(d) => dayLabel(addDays(today, d))}
          onChange={(d) => {
            ask.reset();
            setOffset(d);
          }}
        />
        <View style={styles.row}>
          <ThemedText style={styles.flex}>From</ThemedText>
          <Stepper
            label="start time"
            value={startsAt}
            step={30}
            min={0}
            max={LAST_MINUTE}
            format={timeOfDay}
            onChange={setStartsAt}
          />
        </View>
        <View style={styles.row}>
          <ThemedText style={styles.flex}>To</ThemedText>
          <Stepper
            label="end time"
            value={endsAt}
            step={30}
            min={30}
            max={LAST_MINUTE}
            format={timeOfDay}
            onChange={setEndsAt}
          />
        </View>
        <ThemedText type="smallBold">Reason</ThemedText>
        <View style={styles.chips}>
          {permissionReasons.map((r) => (
            <Chip
              key={r.value}
              label={r.label}
              selected={reason === r.value}
              onPress={() => setReason(r.value)}
            />
          ))}
        </View>
        <TextField
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          maxLength={MAX_NOTE}
          multiline
        />
        {tried && problem ? (
          <ThemedText type="small" themeColor="danger">
            {problem}
          </ThemedText>
        ) : null}
        <Button
          label={ask.isSuccess ? 'Sent to owner' : 'Send to owner'}
          icon={ask.isSuccess ? 'checkmark' : 'send'}
          loading={ask.isPending}
          onPress={submit}
        />
        {ask.error ? (
          <ThemedText type="small" themeColor="danger">
            Couldn&apos;t send: {ask.error.message}
          </ThemedText>
        ) : null}
      </Card>

      <SectionHeader title="My requests" />
      <QueryState query={mine} isEmpty={(list) => list.length === 0} emptyText="No requests yet.">
        {(list) =>
          sortPermissions(list).map((p) => (
            <PermissionCard key={p.id} permission={p}>
              {p.status === 'pending' ? (
                <Button
                  label="Cancel request"
                  variant="secondary"
                  size="compact"
                  loading={cancel.isPending && cancel.variables === p.id}
                  onPress={() => cancel.mutate(p.id)}
                />
              ) : null}
            </PermissionCard>
          ))
        }
      </QueryState>
      {cancel.error ? (
        <ThemedText type="small" themeColor="danger">
          {cancel.error.message}
        </ThemedText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
    minWidth: 64,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
