import { type ReactNode } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { ConfirmDialogHost } from '@/components/confirm-dialog';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { usePerfScreen } from '@/hooks/use-perf-screen';
import { usePullToRefresh, useRefreshOnFocus, useScreenQueries } from '@/hooks/use-pull-to-refresh';
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
  const screenId = useScreenQueries();
  const { refreshing, onRefresh } = usePullToRefresh(screenId);
  useRefreshOnFocus(refreshable, screenId);
  usePerfScreen();
  const focused = useIsFocused();

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
      {/* confirm() dialogs draw from the focused screen: on iOS a Modal mounted at the root can't
          show above a screen presented as a modal (Account), so it never appeared there. */}
      {focused ? <ConfirmDialogHost /> : null}
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
