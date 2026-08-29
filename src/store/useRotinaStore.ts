import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Rotina, WeekLog } from '../types/workout';
import { useWorkoutStore } from './useWorkoutStore';

interface RotinaState {
  /** Sucessor direto de jg3_rotinas (_getRotinas/_setRotinas). Mais recente primeiro. */
  rotinas: Rotina[];

  /** Equivale a rotinaSaveFromCurrent() + _savRotina(). */
  salvar: (nome: string, log: WeekLog) => void;
  /** Equivale a rotinaExcluir(). */
  remover: (id: number) => void;
  /** Equivale a _rotinaExec(idx, mode) — aplica direto em useWorkoutStore. */
  aplicar: (id: number, mode: 'replace' | 'merge') => Rotina | null;
}

export const useRotinaStore = create<RotinaState>()(
  persist(
    (set, get) => ({
      rotinas: [],

      salvar: (nome, log) =>
        set((state) => ({
          rotinas: [{ id: Date.now(), nome, log: JSON.parse(JSON.stringify(log)), criada: new Date().toISOString() }, ...state.rotinas],
        })),

      remover: (id) => set((state) => ({ rotinas: state.rotinas.filter((r) => r.id !== id) })),

      aplicar: (id, mode) => {
        const r = get().rotinas.find((x) => x.id === id);
        if (!r) return null;

        if (mode === 'replace') {
          useWorkoutStore.setState({ weekLog: JSON.parse(JSON.stringify(r.log)), weekPSE: {} });
        } else {
          const current = useWorkoutStore.getState().weekLog;
          const merged: WeekLog = { ...current };
          Object.entries(r.log).forEach(([d, entries]) => {
            if (!entries?.length) return;
            const day = Number(d);
            merged[day] = [...(merged[day] ?? []), ...JSON.parse(JSON.stringify(entries))];
          });
          useWorkoutStore.setState({ weekLog: merged });
        }
        return r;
      },
    }),
    { name: 'jg3_rotinas' }
  )
);
