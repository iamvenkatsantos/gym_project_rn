import { type ReactNode } from 'react';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { spotsLeft } from '@/features/bookings/rules';
import type { GymClass } from '@/features/bookings/types';
import { formatDateTime } from '@/lib/format';

type ClassCardProps = {
  gymClass: GymClass;
  action?: ReactNode;
};

export function ClassCard({ gymClass, action }: ClassCardProps) {
  const left = spotsLeft(gymClass);

  return (
    <Card>
      <ThemedText type="smallBold">{gymClass.title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {formatDateTime(gymClass.startsAt)} · {gymClass.durationMinutes} min · with{' '}
        {gymClass.trainerName}
      </ThemedText>
      <ThemedText type="small">
        {left === 0 ? 'Full' : `${left} of ${gymClass.capacity} spots left`}
      </ThemedText>
      {action}
    </Card>
  );
}
