import { type ReactNode } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { usePullToRefresh, useRefreshOnFocus } from '@/hooks/use-pull-to-refresh';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = {
  eyebrow?: string;
  title?: string;
  children: ReactNode;
  /** Pull down to refetch the screen's data. Off for forms, where a pull would only get in the way. */
  refreshable?: boolean;
};

export function Screen({ eyebrow, title, children, refreshable = true }: ScreenProps) {
  const theme = useTheme();
  const { refreshing, onRefresh } = usePullToRefresh();
  useRefreshOnFocus(refreshable);

  return (
    <ThemedView style={styles.root}>
      {/* Scrolls the focused field above the keyboard; taps on buttons still land while it's open. */}
      <KeyboardAwareScrollView
        bottomOffset={Spacing.four}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          refreshable ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.accent}
              colors={[theme.accent]}
              progressBackgroundColor={theme.backgroundElement}
            />
          ) : undefined
        }>
        {title ? (
          <View>
            {eyebrow ? (
              <ThemedText type="label" themeColor="accent">
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
