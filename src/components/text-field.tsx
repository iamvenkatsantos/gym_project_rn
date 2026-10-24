import { useState, type ComponentRef, type Ref } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextFieldProps = TextInputProps & {
  label: string;
  /** Shown inside the field, before the text. */
  icon?: IconName;
  ref?: Ref<ComponentRef<typeof TextInput>>;
};

/**
 * A labelled text input in the app's style. Password fields (secureTextEntry)
 * get a show/hide button, since typos are easy on a phone keyboard.
 */
export function TextField({
  label,
  icon,
  style,
  multiline,
  secureTextEntry,
  onFocus,
  onBlur,
  ref,
  ...rest
}: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={styles.field}>
      <ThemedText type="label" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View
        style={[
          styles.box,
          multiline && styles.multiline,
          {
            borderColor: focused ? theme.primary : theme.border,
            backgroundColor: theme.backgroundElement,
          },
        ]}>
        {icon ? <Icon name={icon} size={18} color={focused ? 'primary' : 'textSecondary'} /> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={theme.textSecondary}
          multiline={multiline}
          secureTextEntry={secureTextEntry && !revealed}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, multiline && styles.multilineInput, { color: theme.text }, style]}
          {...rest}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            hitSlop={8}
            onPress={() => setRevealed((r) => !r)}>
            <Icon name={revealed ? 'eye-off-outline' : 'eye-outline'} size={20} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: TapTarget,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },
  input: {
    flex: 1,
    // Without this, web TextInputs keep their intrinsic width and overflow the row.
    minWidth: 0,
    minHeight: TapTarget - 2,
    fontSize: 16,
  },
  multiline: {
    alignItems: 'flex-start',
  },
  multilineInput: {
    minHeight: 88,
    paddingTop: Spacing.three,
    textAlignVertical: 'top',
  },
});
