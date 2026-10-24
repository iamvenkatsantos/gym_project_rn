import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { TrainerAvatar } from '@/features/trainers/components/trainer-avatar';
import type { Trainer } from '@/features/trainers/types';

export function TrainerCard({ trainer }: { trainer: Trainer }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Book ${trainer.fullName}`}
      onPress={() =>
        router.push({ pathname: '/book-trainer/[trainerId]', params: { trainerId: trainer.id } })
      }>
      {({ pressed }) => (
        <Card style={pressed && styles.pressed}>
          <View style={styles.header}>
            <TrainerAvatar name={trainer.fullName} />
            <View style={styles.body}>
              <ThemedText type="heading">{trainer.fullName}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {trainer.sessionMinutes} min sessions
              </ThemedText>
            </View>
            <Icon name="chevron-forward" size={20} />
          </View>
          <View style={styles.pills}>
            {trainer.specialties.map((specialty) => (
              <Pill key={specialty} label={specialty} />
            ))}
          </View>
        </Card>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  body: {
    flex: 1,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.75,
  },
});
