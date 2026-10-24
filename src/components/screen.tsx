import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

type ScreenProps = {
  eyebrow?: string;
  title?: string;
  children: ReactNode;
};

export function Screen({ eyebrow, title, children }: ScreenProps) {
  return (
    <ThemedView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        {title ? (
          <View>
            {eyebrow ? (
              <ThemedText type="label" themeColor="primary">
                {eyebrow}
              </ThemedText>
            ) : null}
            <ThemedText type="title">{title}</ThemedText>
          </View>
        ) : null}
        {children}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    gap: Spacing.three,
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
