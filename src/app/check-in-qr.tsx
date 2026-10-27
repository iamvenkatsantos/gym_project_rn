import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { SegmentedControl } from '@/components/segmented-control';
import { Stepper } from '@/components/stepper';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym } from '@/features/auth/use-profile';
import type { CheckInSettings } from '@/features/check-in/api';
import { QrCode } from '@/features/check-in/components/qr-code';
import { useCheckInQr, useSaveCheckInSettings } from '@/features/check-in/hooks';
import { checkInLink } from '@/features/check-in/rules';
import type { CheckInQr } from '@/features/check-in/types';

const hours = (h: number) => `${h} h`;

function Settings({ gymId, qr, isOwner }: { gymId: string; qr: CheckInQr; isOwner: boolean }) {
  const [draft, setDraft] = useState<CheckInSettings>({
    qrOnly: qr.qrOnly,
    posterEnabled: qr.posterEnabled,
    memberAutoOutHours: qr.memberAutoOutHours,
    trainerAutoOutHours: qr.trainerAutoOutHours,
  });
  const save = useSaveCheckInSettings(gymId);
  const set = (next: Partial<CheckInSettings>) => {
    save.reset();
    setDraft((d) => ({ ...d, ...next }));
  };

  if (!isOwner) {
    return (
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          {qr.qrOnly
            ? 'Members and trainers have to scan the QR to check in.'
            : 'Members and trainers scan the QR, or tap Check in on Home.'}{' '}
          The printed QR is {qr.posterEnabled ? 'on' : 'off'}. Members are checked out after{' '}
          {hours(qr.memberAutoOutHours)}, trainers after {hours(qr.trainerAutoOutHours)}. Only
          owners change these.
        </ThemedText>
      </Card>
    );
  }

  return (
    <Card>
      <ThemedText type="smallBold">How people check in</ThemedText>
      <SegmentedControl
        options={[
          { value: 'both', label: 'QR or button' },
          { value: 'qr', label: 'QR only' },
        ]}
        value={draft.qrOnly ? 'qr' : 'both'}
        onChange={(v) => set({ qrOnly: v === 'qr' })}
      />
      <ThemedText type="small" themeColor="textSecondary">
        {draft.qrOnly
          ? 'The Check in button on Home is hidden, so nobody checks in from outside the gym. Check out still works without scanning.'
          : 'The Check in button on Home stays as a backup.'}
      </ThemedText>

      <ThemedText type="smallBold">Printed QR</ThemedText>
      <SegmentedControl
        options={[
          { value: 'on', label: 'On' },
          { value: 'off', label: 'Off' },
        ]}
        value={draft.posterEnabled ? 'on' : 'off'}
        onChange={(v) => set({ posterEnabled: v === 'on' })}
      />

      <ThemedText type="smallBold">Check out automatically after</ThemedText>
      <View style={styles.stepperRow}>
        <ThemedText style={styles.flex}>Members</ThemedText>
        <Stepper
          label="hours before members are checked out"
          value={draft.memberAutoOutHours}
          onChange={(h) => set({ memberAutoOutHours: h })}
          min={1}
          max={12}
          format={hours}
        />
      </View>
      <View style={styles.stepperRow}>
        <ThemedText style={styles.flex}>Trainers</ThemedText>
        <Stepper
          label="hours before trainers are checked out"
          value={draft.trainerAutoOutHours}
          onChange={(h) => set({ trainerAutoOutHours: h })}
          min={1}
          max={24}
          format={hours}
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        For people who forget to scan out. Reports mark these check-outs as auto.
      </ThemedText>

      <Button
        label={save.isSuccess ? 'Saved' : 'Save settings'}
        icon={save.isSuccess ? 'checkmark' : undefined}
        loading={save.isPending}
        onPress={() => save.mutate(draft)}
      />
      {save.error ? (
        <ThemedText type="small" themeColor="danger">
          Couldn&apos;t save: {save.error.message}
        </ThemedText>
      ) : null}
    </Card>
  );
}

/**
 * The branch's check-in QR for owners and supervisors: the live code for a
 * screen at the desk, the printed poster, and (owners) the rules.
 */
export default function CheckInQrScreen() {
  const gym = useActiveGym();
  const isOwner = gym.role === 'owner';
  const qr = useCheckInQr(gym.gymId);
  const { width } = useWindowDimensions();
  const posterSize = Math.min(width - Spacing.three * 4, 260);

  return (
    <Screen>
      <QueryState query={qr}>
        {(data) => (
          <>
            <SectionHeader title="Printed QR" />
            <Card>
              {data.posterEnabled ? (
                <>
                  <View style={styles.center}>
                    <QrCode
                      value={checkInLink({ gymId: gym.gymId, code: data.posterCode })}
                      size={posterSize}
                      label={`Poster QR for ${data.gymName}`}
                    />
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    The QR CoreFit Gym sent you for this branch. Put the printout at the front desk.
                    A photo of it works from anywhere, so if it gets shared, ask CoreFit Gym for a
                    new one.
                  </ThemedText>
                </>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  The printed QR is switched off, so only the live QR works.
                </ThemedText>
              )}
            </Card>

            <SectionHeader title="Live QR (optional)" />
            <Card>
              <ThemedText type="small" themeColor="textSecondary">
                Safer than a printout. The code changes every 30 seconds, so a photo sent to a
                friend stops working almost at once. Show it on a spare phone or tablet at the desk,
                signed in as you or a supervisor.
              </ThemedText>
              <Button
                label="Show live QR"
                icon="qr-code-outline"
                onPress={() => router.push('/check-in-display')}
              />
            </Card>

            <SectionHeader title="Settings" />
            <Settings key={gym.gymId} gymId={gym.gymId} qr={data} isOwner={isOwner} />
          </>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
    minWidth: 96,
  },
});
