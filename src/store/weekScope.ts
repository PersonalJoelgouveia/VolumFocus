import { useWorkoutStore } from './useWorkoutStore';
import type { WorkoutState } from './useWorkoutStore';
import { exDoneKey } from '../types/workout';
import { EMPTY_RETRO_WEEK, useRetroWeeksStore } from './useRetroWeeksStore';
import { useUIStore } from './useUIStore';

/**
 * Fachada "semana em edição": as telas de Registro leem/gravam por aqui. Sem semana retroativa aberta
 * ela É o store da semana atual (comportamento idêntico ao de antes); com uma semana retroativa aberta
 * (Performance → clique num dia passado) aponta para `useRetroWeeksStore`. Assim a semana atual, as
 * sincronizações e as conquistas nunca são tocadas ao lançar um treino do passado.
 */
export type WeekApi = Pick<
  WorkoutState,
  | 'weekLog'
  | 'selectedDay'
  | 'weekPSE'
  | 'exDone'
  | 'selectDay'
  | 'setDayPSE'
  | 'getDayLog'
  | 'setDayLog'
  | 'addLogEntry'
  | 'updateLogEntry'
  | 'removeLogEntry'
  | 'isExerciseDone'
  | 'markExerciseDone'
  | 'unmarkExerciseDone'
  | 'clearDayDone'
>;

type Actions = Pick<
  WeekApi,
  | 'selectDay'
  | 'setDayPSE'
  | 'getDayLog'
  | 'setDayLog'
  | 'addLogEntry'
  | 'updateLogEntry'
  | 'removeLogEntry'
  | 'isExerciseDone'
  | 'markExerciseDone'
  | 'unmarkExerciseDone'
  | 'clearDayDone'
>;

// Ações com identidade estável por semana (evita re-render por função nova a cada seleção).
const actionCache = new Map<string, Actions>();

function actionsFor(key: string): Actions {
  let a = actionCache.get(key);
  if (a) return a;
  const r = () => useRetroWeeksStore.getState();
  a = {
    selectDay: (day) => r().selectDay(day),
    setDayPSE: (day, pse) => r().setDayPSE(key, day, pse),
    getDayLog: (day) => (r().weeks[key] ?? EMPTY_RETRO_WEEK).weekLog[day] ?? [],
    setDayLog: (day, log) => r().setDayLog(key, day, log),
    addLogEntry: (day, entry) => r().addLogEntry(key, day, entry),
    updateLogEntry: (day, index, patch) => r().updateLogEntry(key, day, index, patch),
    removeLogEntry: (day, index) => r().removeLogEntry(key, day, index),
    isExerciseDone: (day, index) => !!(r().weeks[key] ?? EMPTY_RETRO_WEEK).exDone[exDoneKey(day, index)],
    markExerciseDone: (day, index) => r().markExerciseDone(key, day, index),
    unmarkExerciseDone: (day, index) => r().unmarkExerciseDone(key, day, index),
    clearDayDone: (day) => r().clearDayDone(key, day),
  };
  actionCache.set(key, a);
  return a;
}

function projectRetro(s: ReturnType<typeof useRetroWeeksStore.getState>): WeekApi {
  const key = s.activeKey ?? '';
  const w = s.weeks[key] ?? EMPTY_RETRO_WEEK;
  return { weekLog: w.weekLog, weekPSE: w.weekPSE, exDone: w.exDone, selectedDay: s.selectedDay, ...actionsFor(key) };
}

/** Hook: seleciona um campo/ação da semana em edição (atual ou retroativa aberta). */
export function useWeek<T>(selector: (s: WeekApi) => T): T {
  const retro = useRetroWeeksStore((s) => s.activeKey !== null) && useUIStore((s) => s.activeView === 'retro');
  const atual = useWorkoutStore((s) => selector(s));
  const passada = useRetroWeeksStore((s) => selector(projectRetro(s)));
  return retro ? passada : atual;
}

/** Não-hook: API da semana em edição agora (para handlers/efeitos). */
export function getWeekApi(): WeekApi {
  const r = useRetroWeeksStore.getState();
  return retroAtivo() ? projectRetro(r) : useWorkoutStore.getState();
}

/** Semana retroativa em edição agora? (aberta E a tela atual é a de treino retroativo). */
export function retroAtivo(): boolean {
  return useRetroWeeksStore.getState().activeKey !== null && useUIStore.getState().activeView === 'retro';
}

/** Chave da semana retroativa aberta (ou null). */
export function useRetroKey(): string | null {
  const key = useRetroWeeksStore((s) => s.activeKey);
  const naTela = useUIStore((s) => s.activeView === 'retro');
  return naTela ? key : null;
}
