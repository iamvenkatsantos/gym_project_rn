import { StyleSheet } from 'react-native';

import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';

type StatTileProps = {
  label: string;
  value: number | string | undefined;
  icon: IconName;
  accent?: boolean;
};

export function StatTile({ label, value, icon, accent }: StatTileProps) {
  return (
    <Card style={styles.tile}>
      <Icon name={icon} size={20} color={accent ? 'primary' : 'textSecondary'} />
      <ThemedText type="title" themeColor={accent ? 'primary' : 'text'}>
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
});
