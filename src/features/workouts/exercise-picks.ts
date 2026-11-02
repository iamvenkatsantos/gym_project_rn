import { create } from 'zustand';

import type { Exercise } from '@/features/exercises/types';

/**
 * Hands exercises from the Add exercises screen back to the plan being edited.
 * The plan editor opens it with what's already in the plan and a callback.
 * A workout's Replace opens it for one pick, filtered to the same muscle.
 */
type PickOptions = {
  /** Close after the first pick. */
  single?: boolean;
  /** Start filtered to this muscle group. */
  muscle?: string | null;
};

type PicksState = {
  excludeIds: string[];
  onPick: ((exercise: Exercise) => void) | null;
  options: PickOptions;
  open: (excludeIds: string[], onPick: (exercise: Exercise) => void, options?: PickOptions) => void;
  pick: (exercise: Exercise) => void;
  close: () => void;
};

export const useExercisePicks = create<PicksState>((set, get) => ({
  excludeIds: [],
  onPick: null,
  options: {},
  open: (excludeIds, onPick, options = {}) => set({ excludeIds, onPick, options }),
  pick: (exercise) => {
    get().onPick?.(exercise);
    set((s) => ({ excludeIds: [...s.excludeIds, exercise.id] }));
  },
  close: () => set({ excludeIds: [], onPick: null, options: {} }),
}));
