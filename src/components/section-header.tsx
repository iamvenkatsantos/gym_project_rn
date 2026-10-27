import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type SectionHeaderProps = {
  title: string;
  detail?: string;
};

export function SectionHeader({ title, detail }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <ThemedText type="label" themeColor="textSecondary">
        {title}
      </ThemedText>
      {detail ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.detail}>
          {detail}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    columnGap: Spacing.three,
    marginTop: Spacing.two,
  },
  // Drops under the title when both don't fit on one line, as with a large font.
  detail: {
    flexShrink: 1,
  },
});
