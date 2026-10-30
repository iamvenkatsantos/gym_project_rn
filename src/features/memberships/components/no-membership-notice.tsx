import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/** Shown to a member with no membership covering today, where they'd check in, train or book. */
export function NoMembershipNotice({ action }: { action: string }) {
  return (
    <Card>
      <View style={styles.row}>
        <Icon name="lock-closed-outline" size={22} color="warning" />
        <View style={styles.flex}>
          <ThemedText type="smallBold">No active membership</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Renew to {action}.
          </ThemedText>
        </View>
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
});
