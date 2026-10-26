import { StyleSheet } from 'react-native';

import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';

type StatTileProps = {
  label: string;
  value: number | string | undefined;
  icon: IconName;
  accent?: boolean;
  /** Smaller number so three fit across a phone. */
  compact?: boolean;
};

export function StatTile({ label, value, icon, accent, compact }: StatTileProps) {
  return (
    <Card style={[styles.tile, compact && styles.compact]}>
      <Icon name={icon} size={20} color={accent ? 'accent' : 'textSecondary'} />
      <ThemedText type={compact ? 'heading' : 'title'} themeColor={accent ? 'accent' : 'text'}>
        {value ?? '–'}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: 140,
  },
  compact: {
    flexBasis: 90,
  },
});
