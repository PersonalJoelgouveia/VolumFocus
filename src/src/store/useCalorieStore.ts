import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Gasto calórico em tempo real via MET — migrado fielmente de `metState`
 * (index.html ~9952) e de _metCalcKcal/_metSavePeso/_metLoadPeso.
 * Persistido sob a mesma chave lógica de jg3_met_peso.
 */
interface CalorieState {
  /** Peso corporal (kg). Setar o peso ativa o cálculo (mesmo acoplamento de metState.active/pesoKg). */
  bodyWeightKg: number | null;
  /** MET musculação padrão (metState.MET). */
  met: number;
  isActive: boolean;

  /** Sucessor de #met-modal / metConfirm()/metDecline()/metActivateFromDashboard(). */
  isWeightModalOpen: boolean;
  openWeightModal: () => void;
  closeWeightModal: () => void;

  setBodyWeightKg: (kg: number) => void;

  /** Equivale a _metCalcKcal(elapsedSec) (index.html ~9971). Fórmula: MET×3.5×peso/200 × minutos. */
  calcKcal: (elapsedSeconds: number) => number | null;
}

export const useCalorieStore = create<CalorieState>()(
  persist(
    (set, get) => ({
      bodyWeightKg: null,
      met: 5.0,
      isActive: false,
      isWeightModalOpen: false,

      openWeightModal: () => set({ isWeightModalOpen: true }),
      closeWeightModal: () => set({ isWeightModalOpen: false }),

      setBodyWeightKg: (kg) => set({ bodyWeightKg: kg, isActive: true, isWeightModalOpen: false }),

      calcKcal: (elapsedSeconds) => {
        const { isActive, bodyWeightKg, met } = get();
        if (!isActive || !bodyWeightKg) return null;
        const minutes = elapsedSeconds / 60;
        return ((met * 3.5 * bodyWeightKg) / 200) * minutes;
      },
    }),
    { name: 'jg3_met_peso' }
  )
);
