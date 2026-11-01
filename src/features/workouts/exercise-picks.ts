import { create } from 'zustand';

import type { Exercise } from '@/features/exercises/types';

/**
 * Hands exercises from the Add exercises screen back to the plan being edited.
 * The plan editor opens it with what's already in the plan and a callback.
 */
type PicksState = {
  excludeIds: string[];
  onPick: ((exercise: Exercise) => void) | null;
  open: (excludeIds: string[], onPick: (exercise: Exercise) => void) => void;
  pick: (exercise: Exercise) => void;
  close: () => void;
};

export const useExercisePicks = create<PicksState>((set, get) => ({
  excludeIds: [],
  onPick: null,
  open: (excludeIds, onPick) => set({ excludeIds, onPick }),
  pick: (exercise) => {
    get().onPick?.(exercise);
    set((s) => ({ excludeIds: [...s.excludeIds, exercise.id] }));
  },
  close: () => set({ excludeIds: [], onPick: null }),
}));
