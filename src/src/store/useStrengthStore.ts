import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StrFormulaKey, StrRecord } from '../types/strength';

interface StrengthState {
  /** Sucessor direto de strState.records (jg3_strength_records) — indexado por nome do exercício. */
  records: Record<string, StrRecord>;

  /** Salva/atualiza um recorde (só aceita valores superiores ao recorde
   *  anterior para o mesmo exercício). Retorna true se foi um novo recorde. */
  upsertRecord: (exerciseName: string, weight: number, reps: number, oneRM: number, formula: StrFormulaKey, rir: number) => boolean;
}

export const useStrengthStore = create<StrengthState>()(
  persist(
    (set, get) => ({
      records: {},

      upsertRecord: (exerciseName, weight, reps, oneRM, formula, rir) => {
        const existing = get().records[exerciseName];
        if (existing && oneRM <= existing.oneRM) return false;
        set((state) => ({
          records: {
            ...state.records,
            [exerciseName]: { weight, reps, rir: rir || 0, oneRM, formula: formula || 'hibrida', date: new Date().toLocaleDateString('pt-BR') },
          },
        }));
        return true;
      },
    }),
    { name: 'jg3_strength_records' }
  )
);
