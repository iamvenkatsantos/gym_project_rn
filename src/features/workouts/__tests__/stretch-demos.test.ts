import { demoFor } from '@/features/exercises/demos';
import { stretchDemos } from '@/features/workouts/stretch-demos';
import { stretches } from '@/features/workouts/stretches';

describe('stretch demos', () => {
  it('has start and end photos for every stretch', () => {
    for (const s of stretches) expect(demoFor(s.id)?.frames).toHaveLength(2);
  });

  it('has no photos for stretches that no longer exist', () => {
    const ids = stretches.map((s) => s.id);
    expect(Object.keys(stretchDemos).filter((id) => !ids.includes(id))).toEqual([]);
  });
});
