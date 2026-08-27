import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HistoricoSemana } from '../types/history';

interface HistoricoState {
  /** Sucessor de historico_semanas (index.html ~5350-5356). Mais recente primeiro. */
  semanas: HistoricoSemana[];
  /** Arquiva um snapshot no topo da lista — equivale a hist.unshift(snap); saveHistoricoSemanas(hist). */
  arquivar: (snapshot: HistoricoSemana) => void;
}

export const useHistoricoStore = create<HistoricoState>()(
  persist(
    (set) => ({
      semanas: [],
      arquivar: (snapshot) => set((state) => ({ semanas: [snapshot, ...state.semanas] })),
    }),
    {
      // Mesma chave do monolito — reaproveitável no backup pessoal (backups/{email}).
      name: 'historico_semanas',
    }
  )
);
