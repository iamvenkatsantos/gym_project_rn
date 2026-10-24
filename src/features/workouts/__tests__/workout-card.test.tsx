import { render, screen } from '@testing-library/react-native';

import { WorkoutCard } from '@/features/workouts/components/workout-card';
import type { Workout } from '@/features/workouts/types';

const workout: Workout = {
  id: 'w-1',
  trainerId: 't-1',
  title: 'Full body starter',
  description: 'A balanced first session.',
  level: 'beginner',
  durationMinutes: 45,
  exercises: [
    {
      exerciseId: 'e-1',
      name: 'Goblet squat',
      sets: 3,
      reps: 12,
      targetWeightKg: 12,
      restSeconds: 90,
    },
    {
      exerciseId: 'e-2',
      name: 'Push-up',
      sets: 3,
      reps: 10,
      targetWeightKg: null,
      restSeconds: 60,
    },
  ],
};

describe('WorkoutCard', () => {
  it('shows the summary and each exercise', async () => {
    await render(<WorkoutCard workout={workout} />);

    expect(screen.getByText('Full body starter')).toBeTruthy();
    expect(screen.getByText('45 min')).toBeTruthy();
    expect(screen.getByText('2 exercises')).toBeTruthy();
    expect(screen.getByText('Goblet squat')).toBeTruthy();
    expect(screen.getByText('3 × 10')).toBeTruthy();
    expect(screen.getByText('3 × 12 · 12 kg')).toBeTruthy();
  });
});
