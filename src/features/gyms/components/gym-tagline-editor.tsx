import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { SectionHeader } from '@/components/section-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAdminGymTagline, useSaveGymTagline } from '@/features/gyms/hooks';
import { cleanTagline, MAX_TAGLINE, validateTagline } from '@/features/gyms/rules';
import { alert } from '@/i18n/alert';
import { useTheme } from '@/hooks/use-theme';

/** Admin only: a short line under the gym's name on the launch screen and sign-in. */
export function GymTaglineEditor({ gymId }: { gymId: string }) {
  const current = useAdminGymTagline(gymId);
  if (!current.data && current.isPending) return null;
  // Keyed by the saved value, so the field starts from it and resets after a save.
  return <TaglineForm key={current.data ?? ''} gymId={gymId} saved={current.data ?? ''} />;
}

function TaglineForm({ gymId, saved }: { gymId: string; saved: string }) {
  const theme = useTheme();
  const save = useSaveGymTagline(gymId);
  const [text, setText] = useState(saved);
  const error = validateTagline(text);
  const changed = cleanTagline(text) !== saved;

  return (
    <View style={{ gap: Spacing.two }}>
      <SectionHeader title="Gym tagline" />
      <TextField
        label="Tagline"
        value={text}
        onChangeText={setText}
        placeholder="Train hard. Recover harder."
        error={error}
        showError
        maxLength={MAX_TAGLINE + 20}
        returnKeyType="done"
      />
      <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: 'right' }}>
        {cleanTagline(text).length}/{MAX_TAGLINE}
      </ThemedText>
      <Button
        label="Save tagline"
        disabled={!!error || !changed}
        loading={save.isPending}
        onPress={() =>
          save.mutate(text, { onError: (e) => alert("Couldn't save the tagline", e.message) })
        }
      />
    </View>
  );
}
