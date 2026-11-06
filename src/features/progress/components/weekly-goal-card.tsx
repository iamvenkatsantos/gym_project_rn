import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { ProgressRing } from '@/components/progress-ring';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { goalLine, type WeeklyGoal } from '@/features/progress/goal';
import { isoWeekday, Weekdays } from '@/features/workouts/schedule';
import { useTheme } from '@/hooks/use-theme';

/** Days trained this week against the member's weekly goal, with the weeks-in-a-row streak. */
export function WeeklyGoalCard({ summary, now = new Date() }: { summary: WeeklyGoal; now?: Date }) {
  const theme = useTheme();
  const today = isoWeekday(now);
  const { goal, done, progress, days, streak } = summary;

  return (
    <Card>
      <View style={styles.row}>
        <ProgressRing
          value={progress}
          accessibilityLabel={`${done} of ${goal} workout days this week`}>
          <ThemedText type="heading" numberOfLines={1}>
            {done}/{goal}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            days
          </ThemedText>
        </ProgressRing>
        <View style={styles.flex}>
          <ThemedText type="label" themeColor="accent">
            Weekly goal
          </ThemedText>
          <ThemedText type="heading">{goalLine(summary)}</ThemedText>
          <View style={styles.streak}>
            <Icon name="flame" size={16} color={streak > 0 ? 'accent' : 'textSecondary'} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {streak > 0
                ? `${streak}-week streak`
                : done >= goal
                  ? 'Streak starts now'
                  : 'Hit it to start a streak'}
            </ThemedText>
          </View>
        </View>
      </View>
      <View style={styles.week}>
        {Weekdays.map(({ day, letter, short }) => {
          const trained = days.includes(day);
          return (
            <View
              key={day}
              accessibilityLabel={`${short}${trained ? ', trained' : ''}`}
              style={[
                styles.day,
                { borderColor: day === today ? theme.accent : 'transparent' },
                { backgroundColor: trained ? theme.primary : theme.backgroundSelected },
              ]}>
              {trained ? (
                <Icon name="checkmark" size={14} color="onPrimary" />
              ) : (
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {letter}
                </ThemedText>
              )}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  day: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
