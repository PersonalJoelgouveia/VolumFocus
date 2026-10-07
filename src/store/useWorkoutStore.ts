import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DayIndex, ExDoneMap, StrengthLogEntry, TrainingLevel, WeekLog, WorkoutDayLog, WorkoutLogEntry } from '../types/workout';
import { exDoneKey } from '../types/workout';

interface WorkoutState {
  /** Log da semana atual, indexado por dia (0=Segunda...6=Domingo). Equivale a `weekLog`. */
  weekLog: WeekLog;
  /** Dia atualmente selecionado na UI. Equivale a `selectedDay`. */
  selectedDay: DayIndex;
  /** Nível de treino do usuário (usado nos alertas de overload). Equivale a `selectedLevel`. */
  selectedLevel: TrainingLevel;
  /** PSE (Percepção Subjetiva do Esforço) por dia, 1-10. Equivale a `weekPSE` / jg3_pse. */
  weekPSE: Record<number, number>;
  /** Exercícios marcados como concluídos (todas as séries feitas) no modal de
   *  execução. Equivale a `jg3_ex_done` / módulo `exDone` (index.html ~9830). */
  exDone: ExDoneMap;

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

  isExerciseDone: (day: number, index: number) => boolean;
  markExerciseDone: (day: number, index: number) => void;
  unmarkExerciseDone: (day: number, index: number) => void;
  clearDayDone: (day: number) => void;
}

type CargaListener = (exId: string, novaCarga: number) => void;
let cargaListener: CargaListener | null = null;
/** Quem quiser saber de edições de peso (sync Personal ⇄ aluno) se registra aqui; `null` desliga. */
export function setCargaEditadaListener(fn: CargaListener | null): void {
  cargaListener = fn;
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      weekLog: {},
      selectedDay: 0,
      selectedLevel: 'intermediario',
      weekPSE: {},
      exDone: {},

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

      updateLogEntry: (day, index, patch) => {
        const antes = get().weekLog[day]?.[index];
        set((state) => {
          const current = state.weekLog[day] ?? [];
          if (!current[index]) return state;
          const updated = [...current];
          updated[index] = { ...updated[index], ...patch } as WorkoutLogEntry;
          return { weekLog: { ...state.weekLog, [day]: updated } };
        });
        // Só edição de peso feita pelo usuário (patch explícito) — não passa por aqui o que é aplicado por sync.
        if (antes && antes.type !== 'cardio' && 'exId' in antes && cargaListener) {
          const patchForca = patch as Partial<StrengthLogEntry>;
          const nova = patchForca.load ?? patchForca.serieLoads?.[0];
          if (typeof nova === 'number' && nova !== antes.load) cargaListener(antes.exId, nova);
        }
      },

      removeLogEntry: (day, index) =>
        set((state) => {
          const current = state.weekLog[day] ?? [];
          return {
            weekLog: { ...state.weekLog, [day]: current.filter((_, i) => i !== index) },
          };
        }),

      clearWeek: () => set({ weekLog: {}, exDone: {} }),

      isExerciseDone: (day, index) => !!get().exDone[exDoneKey(day, index)],

      markExerciseDone: (day, index) =>
        set((state) => ({ exDone: { ...state.exDone, [exDoneKey(day, index)]: true } })),

      unmarkExerciseDone: (day, index) =>
        set((state) => {
          const next = { ...state.exDone };
          delete next[exDoneKey(day, index)];
          return { exDone: next };
        }),

      clearDayDone: (day) =>
        set((state) => {
          const next = { ...state.exDone };
          Object.keys(next).forEach((k) => {
            if (k.startsWith(`${day}:`)) delete next[k as keyof typeof next];
          });
          return { exDone: next };
        }),
    }),
    {
      // Sucessor direto de jg3_log (+ jg3_lv embutido no mesmo store).
      name: 'jg3_log',
    }
  )
);
