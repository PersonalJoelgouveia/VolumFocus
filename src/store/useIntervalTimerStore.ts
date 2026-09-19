import { create } from 'zustand';

/**
 * Timer de intervalos da tela Ferramentas > Timer — reaproveita tecnicamente
 * o mesmo padrão já usado em `useCooperTimerStore` (teste Cooper 12min, ver
 * components/cardio/CardioTestPanel.tsx): estado baseado em timestamp
 * (`startedAt`/`pausedAt`/`pausedMs`), não num contador decrementado —
 * assim o tempo restante é sempre recalculado a partir do relógio real e
 * sobrevive a desmontar/remontar o componente (mesmo motivo por trás do
 * <TimerEngine> global, aqui aplicado localmente).
 *
 * É um store isolado: NÃO tem nenhuma relação com `useTimerStore`
 * (cronômetro global de treino, com toast/conquistas/kcal) nem com
 * `useWorkoutStore`/`useExerciseStore` (dados reais de exercício). "Estímulo"
 * aqui é só um rótulo genérico de ronda — nesta etapa os valores (durações,
 * nº de estímulos) são fixos; configuração avançada fica pra uma etapa futura.
 */
export type TimerPhase = 'preparacao' | 'exercicio' | 'descanso';

export const PREP_SECONDS = 10;
export const WORK_SECONDS = 30;
export const REST_SECONDS = 15;
export const DEFAULT_STIMULI = ['Estímulo 1', 'Estímulo 2', 'Estímulo 3'];

export function phaseDurationMs(phase: TimerPhase): number {
  if (phase === 'preparacao') return PREP_SECONDS * 1000;
  if (phase === 'exercicio') return WORK_SECONDS * 1000;
  return REST_SECONDS * 1000;
}

interface IntervalTimerState {
  /** null = ainda não iniciado, ou já concluído (ver `finished`). */
  phase: TimerPhase | null;
  /** Estímulo atual, 0-based. */
  roundIndex: number;
  stimuli: string[];
  finished: boolean;

  startedAt: number | null;
  pausedAt: number | null;
  pausedMs: number;

  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  /** Chamado pelo efeito local do componente quando o tempo da fase atual se esgota. */
  advancePhase: () => void;
}

export const useIntervalTimerStore = create<IntervalTimerState>()((set, get) => ({
  phase: null,
  roundIndex: 0,
  stimuli: DEFAULT_STIMULI,
  finished: false,
  startedAt: null,
  pausedAt: null,
  pausedMs: 0,

  start: () =>
    set({
      phase: 'preparacao',
      roundIndex: 0,
      finished: false,
      startedAt: Date.now(),
      pausedAt: null,
      pausedMs: 0,
    }),

  pause: () => {
    const s = get();
    if (!s.phase || s.pausedAt || s.finished) return;
    set({ pausedAt: Date.now() });
  },

  resume: () => {
    const s = get();
    if (!s.pausedAt) return;
    set({ pausedMs: s.pausedMs + (Date.now() - s.pausedAt), pausedAt: null });
  },

  reset: () =>
    set({ phase: null, roundIndex: 0, finished: false, startedAt: null, pausedAt: null, pausedMs: 0 }),

  advancePhase: () => {
    const s = get();
    if (!s.phase || s.finished) return;
    const total = s.stimuli.length;

    if (s.phase === 'preparacao') {
      set({ phase: 'exercicio', startedAt: Date.now(), pausedAt: null, pausedMs: 0 });
      return;
    }
    if (s.phase === 'exercicio') {
      const isLast = s.roundIndex >= total - 1;
      if (isLast) {
        set({ finished: true, phase: null, pausedAt: null });
        return;
      }
      set({ phase: 'descanso', startedAt: Date.now(), pausedAt: null, pausedMs: 0 });
      return;
    }
    // descanso → próximo estímulo
    set({ phase: 'exercicio', roundIndex: s.roundIndex + 1, startedAt: Date.now(), pausedAt: null, pausedMs: 0 });
  },
}));

/** Tempo decorrido na fase atual (ms), descontando pausas. */
export function getElapsedMs(state: IntervalTimerState): number {
  if (!state.startedAt) return 0;
  const now = state.pausedAt ?? Date.now();
  return now - state.startedAt - state.pausedMs;
}

/** Tempo restante na fase atual (ms), já limitado a [0, duração da fase]. */
export function getRemainingMs(state: IntervalTimerState): number {
  if (!state.phase) return 0;
  return Math.max(0, phaseDurationMs(state.phase) - getElapsedMs(state));
}
