import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { parseAmount, validateAmount } from '@/lib/validation';

type Props = {
  label: string;
  /** The fee now, in paise; null when there is none of its own. */
  feeCents: number | null;
  pending: boolean;
  error: Error | null;
  onSave: (feeCents: number) => void;
};

/** A monthly fee in rupees, saved with a button so a half-typed number never applies. */
export function FeeEditor({ label, feeCents, pending, error, onSave }: Props) {
  const [text, setText] = useState(feeCents === null ? '' : String(feeCents / 100));
  const invalid = validateAmount(text, { label: 'fee', allowZero: true, max: 1_000_000 });
  const parsed = parseAmount(text);
  const changed = parsed !== null && parsed !== feeCents;

  return (
    <View style={styles.root}>
      <TextField
        label={label}
        icon="cash-outline"
        value={text}
        onChangeText={setText}
        error={invalid}
        keyboardType="decimal-pad"
        placeholder="1500"
        returnKeyType="done"
      />
      <Button
        label="Save fee"
        variant="secondary"
        size="compact"
        disabled={!changed || !!invalid}
        loading={pending}
        onPress={() => parsed !== null && onSave(parsed)}
      />
      {error ? <ThemedText themeColor="danger">{error.message}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.three,
  },
});
