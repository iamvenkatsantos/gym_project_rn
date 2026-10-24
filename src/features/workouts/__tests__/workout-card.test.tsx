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
    { name: 'Goblet squat', sets: 3, reps: 12 },
    { name: 'Push-up', sets: 3, reps: 10 },
  ],
};

describe('WorkoutCard', () => {
  it('shows the summary and each exercise', async () => {
    await render(<WorkoutCard workout={workout} />);

    expect(screen.getByText('Full body starter')).toBeTruthy();
    expect(screen.getByText('beginner · 45 min · 2 exercises')).toBeTruthy();
    expect(screen.getByText('Goblet squat: 3 × 12')).toBeTruthy();
    expect(screen.getByText('Push-up: 3 × 10')).toBeTruthy();
  });
});
