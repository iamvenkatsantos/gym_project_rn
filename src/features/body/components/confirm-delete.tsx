import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type ConfirmDeleteProps = {
  label: string;
  question: string;
  loading: boolean;
  onConfirm: () => void;
};

/** A delete button that asks once before deleting. */
export function ConfirmDelete({ label, question, loading, onConfirm }: ConfirmDeleteProps) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <Button
        label={label}
        variant="danger"
        size="compact"
        icon="trash-outline"
        onPress={() => setAsking(true)}
      />
    );
  }

  return (
    <Card>
      <ThemedText type="smallBold">{question}</ThemedText>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button
            label="Cancel"
            variant="secondary"
            size="compact"
            onPress={() => setAsking(false)}
          />
        </View>
        <View style={styles.flex}>
          <Button
            label="Delete"
            variant="danger"
            size="compact"
            loading={loading}
            onPress={onConfirm}
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
