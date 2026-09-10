import { create } from 'zustand';
import type { MuscleGroup } from '../types/exercise';

/**
 * Esqueleto — implementação completa prevista na Fase 4 (Validação & Analytics).
 * Equivalente futuro do cálculo de volume semanal / overload badges do monolito.
 */
interface AnalyticsState {
  volumeByMuscle: Partial<Record<MuscleGroup, number>>;
  recalculate: () => void;
}

export const useAnalyticsStore = create<AnalyticsState>()((set) => ({
  volumeByMuscle: {},
  recalculate: () => set({ volumeByMuscle: {} }),
}));
