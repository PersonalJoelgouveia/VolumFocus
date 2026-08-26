import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Exercise } from '../types/exercise';
import { MUSCLE_GROUPS } from '../types/exercise';
import { DEFAULT_EXERCISES } from '../data/defaultExercises';

interface ExerciseState {
  /** Banco de exercícios (padrão + criados pelo usuário/PT). Equivale à var `exercises` do monolito. */
  exercises: Exercise[];

  addExercise: (ex: Exercise) => void;
  updateExercise: (id: string, patch: Partial<Omit<Exercise, 'id'>>) => void;
  removeExercise: (id: string) => void;
  getExerciseById: (id: string) => Exercise | undefined;

  /**
   * Mescla exercícios padrão novos (de atualizações do app) que ainda não
   * existem no banco persistido do usuário, sem afetar os criados por ele.
   * Equivale ao merge feito em loadData() (index.html ~4306-4313).
   */
  mergeNewDefaults: () => void;
}

export const useExerciseStore = create<ExerciseState>()(
  persist(
    (set, get) => ({
      exercises: DEFAULT_EXERCISES,

      addExercise: (ex) =>
        set((state) => ({ exercises: [...state.exercises, ex] })),

      updateExercise: (id, patch) =>
        set((state) => ({
          exercises: state.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),

      removeExercise: (id) =>
        set((state) => ({ exercises: state.exercises.filter((e) => e.id !== id) })),

      getExerciseById: (id) => get().exercises.find((e) => e.id === id),

      mergeNewDefaults: () =>
        set((state) => {
          const existingIds = new Set(state.exercises.map((e) => e.id));
          const missing = DEFAULT_EXERCISES.filter((def) => !existingIds.has(def.id));
          if (missing.length === 0) return state;
          return { exercises: [...state.exercises, ...missing] };
        }),
    }),
    {
      // Nome da chave em localStorage — sucessor direto de jg3_ex.
      name: 'jg3_ex',
      onRehydrateStorage: () => (state) => {
        // Garante que grupos musculares inválidos legados nunca cheguem à UI nova.
        state?.exercises.forEach((e) => {
          e.synergist = e.synergist.filter((m) => (MUSCLE_GROUPS as readonly string[]).includes(m));
          e.stabilizer = e.stabilizer.filter((m) => (MUSCLE_GROUPS as readonly string[]).includes(m));
        });
        state?.mergeNewDefaults();
      },
    }
  )
);
