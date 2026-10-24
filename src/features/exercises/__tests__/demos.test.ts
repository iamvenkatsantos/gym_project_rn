import { demoFor, libraryDemoIds, seedIds } from '@/features/exercises/demos';
import { starterExercises } from '@/features/exercises/library';

// Same derivation the seed generator uses, so seeded rows find their demo.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { uuidFor } = require('../../../../scripts/exercise-seed-id');

describe('exercise demos', () => {
  it('has a two-frame demo for every library exercise', () => {
    expect(libraryDemoIds.sort()).toEqual(starterExercises.map((e) => e.id).sort());
    for (const e of starterExercises) {
      expect(demoFor(e.id)?.frames).toHaveLength(2);
    }
  });

  it('maps every seeded database id to its library exercise', () => {
    expect(seedIds).toEqual(Object.fromEntries(starterExercises.map((e) => [uuidFor(e.id), e.id])));
    const [uuid, libraryId] = Object.entries(seedIds)[0];
    expect(demoFor(uuid)?.frames).toEqual(demoFor(libraryId)?.frames);
  });

  it('falls back to the exercise image, without credit', () => {
    expect(demoFor('gym-custom', 'https://example.com/a.jpg')).toEqual({
      frames: [{ uri: 'https://example.com/a.jpg' }],
      credit: null,
    });
    expect(demoFor('gym-custom')).toBeNull();
  });
});
