import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CardioTestResult } from '../types/cardioTest';

interface CardioTestState {
  /** Sucessor de jg3_cardio_data. Mais recente primeiro. */
  testes: CardioTestResult[];
  salvar: (teste: CardioTestResult) => void;
  remover: (id: string) => void;
}

export const useCardioTestStore = create<CardioTestState>()(
  persist(
    (set) => ({
      testes: [],
      salvar: (teste) => set((state) => ({ testes: [teste, ...state.testes] })),
      remover: (id) => set((state) => ({ testes: state.testes.filter((t) => t.id !== id) })),
    }),
    {
      // Mesma chave do monolito — só que agora guarda uma lista, não um objeto único.
      name: 'jg3_cardio_data',
    }
  )
);
