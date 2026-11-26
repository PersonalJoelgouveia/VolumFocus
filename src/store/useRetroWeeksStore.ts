import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DayIndex, ExDoneMap, WeekLog, WorkoutDayLog, WorkoutLogEntry } from '../types/workout';
import { exDoneKey } from '../types/workout';

/**
 * Semanas RETROATIVAS: treinos que o aluno lança depois de já terem passado. Cada semana é
 * identificada pela segunda-feira (AAAA-MM-DD) e guarda o mesmo trio da semana atual
 * (weekLog / weekPSE / exDone). Ficam SEPARADAS do store da semana atual (jg3_log): as sincronizações,
 * conquistas e metas da semana em andamento nunca enxergam estes dados.
 */
export interface RetroWeek {
  weekLog: WeekLog;
  weekPSE: Record<number, number>;
  exDone: ExDoneMap;
}

export const EMPTY_RETRO_WEEK: RetroWeek = { weekLog: {}, weekPSE: {}, exDone: {} };

interface RetroState {
  weeks: Record<string, RetroWeek>;
  /** Semana retroativa aberta na tela (segunda-feira ISO) ou null = fluxo normal da semana atual. */
  activeKey: string | null;
  /** Dia (0=Seg…6=Dom) selecionado na semana retroativa aberta. */
  selectedDay: DayIndex;

  open: (key: string, day: DayIndex) => void;
  closeRetro: () => void;
  selectDay: (day: DayIndex) => void;

  setDayLog: (key: string, day: number, log: WorkoutDayLog) => void;
  addLogEntry: (key: string, day: number, entry: WorkoutLogEntry) => void;
  updateLogEntry: (key: string, day: number, index: number, patch: Partial<WorkoutLogEntry>) => void;
  removeLogEntry: (key: string, day: number, index: number) => void;
  setDayPSE: (key: string, day: number, pse: number) => void;
  markExerciseDone: (key: string, day: number, index: number) => void;
  unmarkExerciseDone: (key: string, day: number, index: number) => void;
  clearDayDone: (key: string, day: number) => void;
  /** Troca todos os dados da semana (usado na restauração de backup). */
  replaceAll: (weeks: Record<string, RetroWeek>) => void;
}

function week(s: RetroState, key: string): RetroWeek {
  return s.weeks[key] ?? EMPTY_RETRO_WEEK;
}
function put(s: RetroState, key: string, w: RetroWeek): Pick<RetroState, 'weeks'> {
  return { weeks: { ...s.weeks, [key]: w } };
}

export const useRetroWeeksStore = create<RetroState>()(
  persist(
    (set) => ({
      weeks: {},
      activeKey: null,
      selectedDay: 0,

      open: (key, day) => set({ activeKey: key, selectedDay: day }),
      closeRetro: () => set({ activeKey: null }),
      selectDay: (day) => set({ selectedDay: day }),

      setDayLog: (key, day, log) =>
        set((s) => {
          const w = week(s, key);
          return put(s, key, { ...w, weekLog: { ...w.weekLog, [day]: log } });
        }),
      addLogEntry: (key, day, entry) =>
        set((s) => {
          const w = week(s, key);
          return put(s, key, { ...w, weekLog: { ...w.weekLog, [day]: [...(w.weekLog[day] ?? []), entry] } });
        }),
      updateLogEntry: (key, day, index, patch) =>
        set((s) => {
          const w = week(s, key);
          const cur = w.weekLog[day] ?? [];
          if (!cur[index]) return s;
          const next = [...cur];
          next[index] = { ...next[index], ...patch } as WorkoutLogEntry;
          return put(s, key, { ...w, weekLog: { ...w.weekLog, [day]: next } });
        }),
      removeLogEntry: (key, day, index) =>
        set((s) => {
          const w = week(s, key);
          const cur = w.weekLog[day] ?? [];
          return put(s, key, { ...w, weekLog: { ...w.weekLog, [day]: cur.filter((_, i) => i !== index) } });
        }),
      setDayPSE: (key, day, pse) =>
        set((s) => {
          const w = week(s, key);
          return put(s, key, { ...w, weekPSE: { ...w.weekPSE, [day]: pse } });
        }),
      markExerciseDone: (key, day, index) =>
        set((s) => {
          const w = week(s, key);
          return put(s, key, { ...w, exDone: { ...w.exDone, [exDoneKey(day, index)]: true } });
        }),
      unmarkExerciseDone: (key, day, index) =>
        set((s) => {
          const w = week(s, key);
          const next = { ...w.exDone };
          delete next[exDoneKey(day, index)];
          return put(s, key, { ...w, exDone: next });
        }),
      clearDayDone: (key, day) =>
        set((s) => {
          const w = week(s, key);
          const next = { ...w.exDone };
          Object.keys(next).forEach((k) => {
            if (k.startsWith(`${day}:`)) delete next[k as keyof typeof next];
          });
          return put(s, key, { ...w, exDone: next });
        }),
      replaceAll: (weeks) => set({ weeks }),
    }),
    {
      name: 'jg3_semanas_retro',
      // Só os dados persistem; a semana aberta na tela é estado de navegação.
      partialize: (s) => ({ weeks: s.weeks }),
    }
  )
);
