import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

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
      {/* Scrolls the focused field above the keyboard; taps on buttons still land while it's open. */}
      <KeyboardAwareScrollView
        bottomOffset={Spacing.four}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic">
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
      </KeyboardAwareScrollView>
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
