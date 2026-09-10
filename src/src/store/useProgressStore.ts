import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StrengthLogEntry, WeekLog } from '../types/workout';
import type { OverloadMessage, OverloadRecord } from '../utils/progressiveOverload';
import { evaluateOverload, resolvePrevRecord } from '../utils/progressiveOverload';

interface ProgressState {
  /** Histórico de carga por exercício. Sucessor de jg3_carga_progresso. */
  loadHistory: Record<string, OverloadRecord>;

  isPopupOpen: boolean;
  popupMessages: OverloadMessage[];

  /**
   * Avalia uma lista de entradas de força (tipicamente o log do dia) contra
   * o histórico e, se qualquer uma disparar a Regra A ou B, abre o popup
   * com todas as mensagens acumuladas — mesma UX de _showPopup(), que
   * agrupava os avisos de um `check()` num único popup.
   */
  checkEntries: (entries: StrengthLogEntry[], weekLog: WeekLog) => void;
  closePopup: () => void;
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      loadHistory: {},
      isPopupOpen: false,
      popupMessages: [],

      checkEntries: (entries, weekLog) => {
        const history = { ...get().loadHistory };
        const allMessages: OverloadMessage[] = [];

        for (const entry of entries) {
          if (!entry.exId) continue;
          const newLoad = entry.serieLoads.length
            ? Math.max(0, ...entry.serieLoads.filter((x) => x > 0))
            : entry.load || 0;
          if (!newLoad) continue;

          const prev = resolvePrevRecord(entry.exId, history, weekLog);
          const { record, messages } = evaluateOverload(entry, prev);
          history[entry.exId] = record;
          allMessages.push(...messages);
        }

        set({ loadHistory: history });
        if (allMessages.length) {
          set({ isPopupOpen: true, popupMessages: allMessages });
        }
      },

      closePopup: () => set({ isPopupOpen: false, popupMessages: [] }),
    }),
    { name: 'jg3_carga_progresso' }
  )
);
