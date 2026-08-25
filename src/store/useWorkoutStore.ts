import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DayIndex, TrainingLevel, WeekLog, WorkoutDayLog, WorkoutLogEntry } from '../types/workout';

interface WorkoutState {
  /** Log da semana atual, indexado por dia (0=Segunda...6=Domingo). Equivale a `weekLog`. */
  weekLog: WeekLog;
  /** Dia atualmente selecionado na UI. Equivale a `selectedDay`. */
  selectedDay: DayIndex;
  /** Nível de treino do usuário (usado nos alertas de overload). Equivale a `selectedLevel`. */
  selectedLevel: TrainingLevel;
  /** PSE (Percepção Subjetiva do Esforço) por dia, 1-10. Equivale a `weekPSE` / jg3_pse. */
  weekPSE: Record<number, number>;

  selectDay: (day: DayIndex) => void;
  setLevel: (level: TrainingLevel) => void;
  setDayPSE: (day: number, pse: number) => void;

  /** Equivale a getDayLog(d). */
  getDayLog: (day: number) => WorkoutDayLog;
  /** Equivale a setDayLog(d, arr). */
  setDayLog: (day: number, log: WorkoutDayLog) => void;

  addLogEntry: (day: number, entry: WorkoutLogEntry) => void;
  updateLogEntry: (day: number, index: number, patch: Partial<WorkoutLogEntry>) => void;
  removeLogEntry: (day: number, index: number) => void;

  /** Limpa o log da semana inteira (equivale ao fluxo de "restaurar semana"). */
  clearWeek: () => void;
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      weekLog: {},
      selectedDay: 0,
      selectedLevel: 'intermediario',
      weekPSE: {},

      selectDay: (day) => set({ selectedDay: day }),
      setLevel: (level) => set({ selectedLevel: level }),
      setDayPSE: (day, pse) => set((state) => ({ weekPSE: { ...state.weekPSE, [day]: pse } })),

      getDayLog: (day) => get().weekLog[day] ?? [],

      setDayLog: (day, log) =>
        set((state) => ({ weekLog: { ...state.weekLog, [day]: log } })),

      addLogEntry: (day, entry) =>
        set((state) => {
          const current = state.weekLog[day] ?? [];
          return { weekLog: { ...state.weekLog, [day]: [...current, entry] } };
        }),

      updateLogEntry: (day, index, patch) =>
        set((state) => {
          const current = state.weekLog[day] ?? [];
          if (!current[index]) return state;
          const updated = [...current];
          updated[index] = { ...updated[index], ...patch } as WorkoutLogEntry;
          return { weekLog: { ...state.weekLog, [day]: updated } };
        }),

      removeLogEntry: (day, index) =>
        set((state) => {
          const current = state.weekLog[day] ?? [];
          return {
            weekLog: { ...state.weekLog, [day]: current.filter((_, i) => i !== index) },
          };
        }),

      clearWeek: () => set({ weekLog: {} }),
    }),
    {
      // Sucessor direto de jg3_log (+ jg3_lv embutido no mesmo store).
      name: 'jg3_log',
    }
  )
);
