import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useUpcomingClasses } from '@/features/bookings/hooks';
import { useMemberships } from '@/features/memberships/hooks';
import { membershipStatus } from '@/features/memberships/rules';

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <Card style={styles.stat}>
      <ThemedText type="subtitle">{value ?? '–'}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </Card>
  );
}

export default function OwnerDashboardScreen() {
  const memberships = useMemberships();
  const classes = useUpcomingClasses();

  const statuses = memberships.data?.map((m) => membershipStatus(m));
  const count = (...wanted: string[]) => statuses?.filter((s) => wanted.includes(s)).length;
  const bookedSpots = classes.data?.reduce((sum, c) => sum + c.bookedCount, 0);

  return (
    <Screen>
      <View style={styles.grid}>
        <Stat label="Active members" value={count('active', 'expiringSoon')} />
        <Stat label="Expiring this week" value={count('expiringSoon')} />
        <Stat label="Upcoming classes" value={classes.data?.length} />
        <Stat label="Spots booked" value={bookedSpots} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  stat: {
    flexGrow: 1,
    flexBasis: 140,
  },
});
