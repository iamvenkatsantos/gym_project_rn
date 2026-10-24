import type { TrainerLink } from '@/features/coaching/types';
import { canViewWorkoutsOf, groupByTrainer, trainerNamesOf } from '@/features/progress/rules';
import type { GymWorkoutLog } from '@/features/progress/types';

const link = (memberId: string, trainerId: string, trainerName: string): TrainerLink => ({
  memberId,
  memberName: memberId,
  trainerId,
  trainerName,
  assignedAt: '2026-10-01',
});

// Maya has two trainers, Arjun one, Priya none.
const links = [
  link('maya', 'tom', 'Tom Trainer'),
  link('maya', 'divya', 'Divya Raman'),
  link('arjun', 'tom', 'Tom Trainer'),
];

const log = (personId: string, personRole: GymWorkoutLog['personRole']): GymWorkoutLog => ({
  clientId: `${personId}-log`,
  workoutId: null,
  title: 'Workout',
  startedAt: '2026-10-20T07:00:00Z',
  completedAt: '2026-10-20T08:00:00Z',
  sets: [],
  personId,
  personName: personId,
  personRole,
});

describe('canViewWorkoutsOf', () => {
  const maya = { id: 'maya', role: 'member' as const };
  const tom = { id: 'tom', role: 'trainer' as const };
  const sam = { id: 'sam', role: 'supervisor' as const };
  const olivia = { id: 'olivia', role: 'owner' as const };

  it('lets owners see everyone', () => {
    for (const person of [maya, tom, sam]) {
      expect(canViewWorkoutsOf(olivia, person, links)).toBe(true);
    }
  });

  it('lets supervisors see trainers and members, not owners or other supervisors', () => {
    expect(canViewWorkoutsOf(sam, maya, links)).toBe(true);
    expect(canViewWorkoutsOf(sam, tom, links)).toBe(true);
    expect(canViewWorkoutsOf(sam, olivia, links)).toBe(false);
    expect(canViewWorkoutsOf(sam, { id: 'sue', role: 'supervisor' }, links)).toBe(false);
  });

  it('lets trainers see only their mapped members', () => {
    expect(canViewWorkoutsOf(tom, maya, links)).toBe(true);
    expect(canViewWorkoutsOf(tom, { id: 'priya', role: 'member' }, links)).toBe(false);
    expect(canViewWorkoutsOf(tom, { id: 'divya', role: 'trainer' }, links)).toBe(false);
  });

  it('lets members see only themselves', () => {
    expect(canViewWorkoutsOf(maya, maya, links)).toBe(true);
    expect(canViewWorkoutsOf(maya, { id: 'arjun', role: 'member' }, links)).toBe(false);
  });
});

describe('trainerNamesOf', () => {
  it('lists every trainer of a member alphabetically', () => {
    expect(trainerNamesOf('maya', links)).toEqual(['Divya Raman', 'Tom Trainer']);
    expect(trainerNamesOf('priya', links)).toEqual([]);
  });
});

describe('groupByTrainer', () => {
  it('lists members under each trainer, then unassigned members, then staff', () => {
    const groups = groupByTrainer(
      [
        log('maya', 'member'),
        log('arjun', 'member'),
        log('priya', 'member'),
        log('tom', 'trainer'),
      ],
      links,
    );
    expect(groups.map((g) => [g.title, g.logs.map((l) => l.personId)])).toEqual([
      ['Divya Raman', ['maya']],
      ['Tom Trainer', ['maya', 'arjun']],
      ['No trainer yet', ['priya']],
      ['Staff', ['tom']],
    ]);
  });

  it('drops empty groups', () => {
    expect(groupByTrainer([log('arjun', 'member')], links).map((g) => g.key)).toEqual(['tom']);
  });
});
