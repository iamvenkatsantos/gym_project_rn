import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { StatTile } from '@/components/stat-tile';
import { Stepper } from '@/components/stepper';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { AttendanceRow } from '@/features/attendance/components/attendance-row';
import { dayLabel, formatMinutes } from '@/features/attendance/rules';
import { useActiveGym } from '@/features/auth/use-profile';
import { PermissionCard } from '@/features/trainer-hours/components/permission-card';
import {
  useDecidePermission,
  usePermissions,
  useSaveTrainerHourRules,
  useTrainerHourRules,
  useTrainerHoursMonth,
} from '@/features/trainer-hours/hooks';
import {
  defaultRules,
  hoursLabel,
  monthLabel,
  monthStart,
  pendingCount,
  rulesProblem,
  sortPermissions,
  summariseMonth,
  weekdays,
} from '@/features/trainer-hours/rules';
import type {
  TrainerHourRules,
  TrainerHourRulesInput,
  TrainerMonth,
} from '@/features/trainer-hours/types';

/** How far back the LOP report goes. */
const MAX_MONTHS_BACK = 12;

function dayDetail(d: TrainerMonth['lopDays'][number]) {
  if (d.absent) return 'Absent';
  const parts = [`Worked ${formatMinutes(d.workedMinutes)}`];
  if (d.permissionMinutes) parts.push(`permission ${formatMinutes(d.permissionMinutes)}`);
  return parts.join(' · ');
}

function TrainerLop({ month, divider }: { month: TrainerMonth; divider: boolean }) {
  const [open, setOpen] = useState(false);
  const lopDays = month.lopDays.length;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        disabled={!lopDays}
        onPress={() => setOpen((o) => !o)}>
        <AttendanceRow
          name={month.fullName}
          detail={`${lopDays} of ${month.workingDays} days short · Worked ${hoursLabel(month.workedMinutes)}`}
          pill={
            month.lopMinutes
              ? { label: `LOP ${hoursLabel(month.lopMinutes)}`, tone: 'danger' }
              : { label: 'No LOP', tone: 'success' }
          }
          divider={divider}
        />
      </Pressable>
      {open
        ? month.lopDays.map((d) => (
            <View key={d.day} style={styles.dayRow}>
              <ThemedText type="small" style={styles.flex}>
                {dayLabel(d.day)}: {dayDetail(d)}
              </ThemedText>
              <ThemedText type="smallBold" themeColor="danger">
                {hoursLabel(d.lopMinutes)}
              </ThemedText>
            </View>
          ))
        : null}
    </>
  );
}

function LopView({ gymId, rules }: { gymId: string; rules: TrainerHourRules }) {
  const [monthsAgo, setMonthsAgo] = useState(0);
  const month = monthStart(monthsAgo);
  const days = useTrainerHoursMonth(gymId, month);
  const trainers = days.data ? summariseMonth(days.data, rules) : undefined;
  const total = trainers?.reduce((sum, t) => sum + t.lopMinutes, 0);

  return (
    <>
      <View style={styles.picker}>
        <Button
          label="Earlier"
          icon="chevron-back"
          variant="secondary"
          size="compact"
          disabled={monthsAgo >= MAX_MONTHS_BACK}
          onPress={() => setMonthsAgo((m) => m + 1)}
        />
        <ThemedText type="heading" style={styles.center}>
          {monthLabel(month)}
        </ThemedText>
        <Button
          label="Later"
          icon="chevron-forward"
          variant="secondary"
          size="compact"
          disabled={monthsAgo === 0}
          onPress={() => setMonthsAgo((m) => m - 1)}
        />
      </View>
      <View style={styles.grid}>
        <StatTile
          label="Total LOP"
          value={total != null ? hoursLabel(total) : undefined}
          icon="cash-outline"
          compact
        />
        <StatTile
          label="Trainers with LOP"
          value={trainers?.filter((t) => t.lopMinutes > 0).length}
          icon="barbell-outline"
          compact
        />
      </View>
      <QueryState
        query={days}
        isEmpty={(list) => list.length === 0}
        emptyText="No working days yet. Today counts from tomorrow.">
        {() => (
          <Card>
            {trainers?.map((t, i) => (
              <TrainerLop key={t.trainerId} month={t} divider={i > 0} />
            ))}
          </Card>
        )}
      </QueryState>
      <ThemedText type="small" themeColor="textSecondary">
        Tap a trainer for short days. Trainers don&apos;t see this.
      </ThemedText>
    </>
  );
}

function RequestsView({ gymId }: { gymId: string }) {
  const permissions = usePermissions(gymId);
  const decide = useDecidePermission();

  return (
    <QueryState
      query={permissions}
      isEmpty={(list) => list.length === 0}
      emptyText="No permission requests yet.">
      {(list) =>
        sortPermissions(list).map((p) => (
          <PermissionCard key={p.id} permission={p} showName>
            {p.status === 'pending' ? (
              <>
                <Button
                  label="Approve"
                  icon="checkmark"
                  size="compact"
                  loading={
                    decide.isPending && decide.variables?.id === p.id && decide.variables.approve
                  }
                  onPress={() => decide.mutate({ id: p.id, approve: true })}
                />
                <Button
                  label="Reject"
                  variant="secondary"
                  size="compact"
                  loading={
                    decide.isPending && decide.variables?.id === p.id && !decide.variables.approve
                  }
                  onPress={() => decide.mutate({ id: p.id, approve: false })}
                />
              </>
            ) : null}
          </PermissionCard>
        ))
      }
    </QueryState>
  );
}

function RulesView({
  gymId,
  rules,
  onSaved,
}: {
  gymId: string;
  rules: TrainerHourRules | null;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<TrainerHourRulesInput>(rules ?? defaultRules);
  const save = useSaveTrainerHourRules(gymId);
  const set = (next: Partial<TrainerHourRulesInput>) => {
    save.reset();
    setDraft((d) => ({ ...d, ...next }));
  };
  const problem = rulesProblem(draft);
  const toggleDay = (d: number) =>
    set({
      offDays: draft.offDays.includes(d)
        ? draft.offDays.filter((x) => x !== d)
        : [...draft.offDays, d].sort(),
    });

  return (
    <Card>
      <View style={styles.row}>
        <ThemedText style={styles.flex}>Working hours a day</ThemedText>
        <Stepper
          label="working hours a day"
          value={draft.requiredMinutes}
          step={30}
          min={60}
          max={16 * 60}
          format={hoursLabel}
          onChange={(m) => set({ requiredMinutes: m })}
        />
      </View>
      <View style={styles.row}>
        <ThemedText style={styles.flex}>Allowed shortfall</ThemedText>
        <Stepper
          label="allowed shortfall"
          value={draft.shortLimitMinutes}
          step={30}
          min={0}
          max={draft.requiredMinutes - 30}
          format={hoursLabel}
          onChange={(m) => set({ shortLimitMinutes: m })}
        />
      </View>
      <View style={styles.row}>
        <ThemedText style={styles.flex}>LOP if shorter</ThemedText>
        <Stepper
          label="LOP hours for a short day"
          value={draft.lopMinutes}
          step={30}
          min={30}
          max={16 * 60}
          format={hoursLabel}
          onChange={(m) => set({ lopMinutes: m })}
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Short by over {hoursLabel(draft.shortLimitMinutes)}: {hoursLabel(draft.lopMinutes)} LOP.
        Absent all day: {hoursLabel(draft.requiredMinutes)} LOP.
      </ThemedText>

      <ThemedText type="smallBold">Weekly off</ThemedText>
      <View style={styles.chips}>
        {weekdays.map((name, d) => (
          <Chip
            key={name}
            label={name}
            selected={draft.offDays.includes(d)}
            onPress={() => toggleDay(d)}
          />
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Approved permission counts as worked.
      </ThemedText>

      {problem ? (
        <ThemedText type="small" themeColor="danger">
          {problem}
        </ThemedText>
      ) : null}
      <Button
        label={save.isSuccess ? 'Saved' : 'Save rules'}
        icon={save.isSuccess ? 'checkmark' : undefined}
        loading={save.isPending}
        disabled={!!problem}
        onPress={() => save.mutate(draft, { onSuccess: rules ? undefined : onSaved })}
      />
      {save.error ? (
        <ThemedText type="small" themeColor="danger">
          Couldn&apos;t save: {save.error.message}
        </ThemedText>
      ) : null}
    </Card>
  );
}

/** Owners only: trainers' LOP by month, permission requests and the working-hours rules. */
export default function TrainerHoursScreen() {
  const gym = useActiveGym();
  const rules = useTrainerHourRules(gym.gymId);
  const permissions = usePermissions(gym.gymId);
  const waiting = permissions.data ? pendingCount(permissions.data) : 0;
  const [view, setView] = useState<'lop' | 'requests' | 'rules' | null>(null);
  // Straight to requests when some are waiting, or to rules before any are set.
  const shown = view ?? (waiting ? 'requests' : rules.data === null ? 'rules' : 'lop');

  return (
    <Screen>
      <SegmentedControl
        options={[
          { value: 'lop', label: 'LOP' },
          { value: 'requests', label: waiting ? `Requests (${waiting})` : 'Requests' },
          { value: 'rules', label: 'Rules' },
        ]}
        value={shown}
        onChange={setView}
      />
      {shown === 'requests' ? (
        <RequestsView gymId={gym.gymId} />
      ) : (
        <QueryState query={rules}>
          {(data) =>
            shown === 'rules' ? (
              <RulesView
                key={gym.gymId}
                gymId={gym.gymId}
                rules={data}
                onSaved={() => setView('lop')}
              />
            ) : data ? (
              <LopView gymId={gym.gymId} rules={data} />
            ) : (
              <Card>
                <ThemedText type="small" themeColor="textSecondary">
                  Set working hours first.
                </ThemedText>
                <Button label="Set working hours" onPress={() => setView('rules')} />
              </Card>
            )
          }
        </QueryState>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  center: {
    flex: 1,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
    minWidth: 96,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.five,
    paddingVertical: Spacing.one,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
