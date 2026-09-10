import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CardioGoalState {
  /** Meta semanal de minutos de cardio. Não existe no HTML de referência
   *  (index.html hardcodeava 90min direto em renderNovaSemana ~5449) —
   *  agora é configurável e persistido, com um só dono: NovaSemanaView
   *  também lê daqui, em vez de repetir o número. */
  metaMin: number;
  setMetaMin: (min: number) => void;
}

export const useCardioGoalStore = create<CardioGoalState>()(
  persist(
    (set) => ({
      metaMin: 90,
      setMetaMin: (min) => set({ metaMin: Math.max(0, min) }),
    }),
    { name: 'jg3_cardio_meta' }
  )
);
