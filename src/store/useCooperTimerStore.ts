import { create } from 'zustand';

export const COOPER_DURATION_MS = 12 * 60 * 1000;

interface CooperTimerState {
  /** Date.now() de quando o teste começou, ou null se não está rodando.
   *  Base em timestamp (não num contador decrementado) — o tempo restante
   *  é sempre recalculado a partir daqui, então navegar para outra view
   *  e voltar (o componente desmonta/remonta) nunca perde precisão. */
  startedAt: number | null;
  /** Timestamp de quando foi pausado — soma-se ao startedAt na retomada. */
  pausedAt: number | null;
  /** Soma de todos os intervalos pausados, em ms. */
  pausedMs: number;
  /** true assim que os 12:00 se esgotam (ou o usuário finaliza manualmente). */
  finished: boolean;

  start: () => void;
  pause: () => void;
  resume: () => void;
  /** Encerra o teste antes dos 12:00 (ex: já correu e só quer lançar o resultado). */
  finishNow: () => void;
  reset: () => void;
}

export const useCooperTimerStore = create<CooperTimerState>()((set, get) => ({
  startedAt: null,
  pausedAt: null,
  pausedMs: 0,
  finished: false,

  start: () => set({ startedAt: Date.now(), pausedAt: null, pausedMs: 0, finished: false }),

  pause: () => {
    const s = get();
    if (!s.startedAt || s.pausedAt) return;
    set({ pausedAt: Date.now() });
  },

  resume: () => {
    const s = get();
    if (!s.pausedAt) return;
    set({ pausedMs: s.pausedMs + (Date.now() - s.pausedAt), pausedAt: null });
  },

  finishNow: () => set({ finished: true }),

  reset: () => set({ startedAt: null, pausedAt: null, pausedMs: 0, finished: false }),
}));

/** Tempo decorrido (ms), descontando pausas — chamar a cada tick, não guardar em estado. */
export function getElapsedMs(state: CooperTimerState): number {
  if (!state.startedAt) return 0;
  const now = state.pausedAt ?? Date.now();
  return now - state.startedAt - state.pausedMs;
}

/** Tempo restante (ms), já limitado a [0, 12min]. */
export function getRemainingMs(state: CooperTimerState): number {
  return Math.max(0, COOPER_DURATION_MS - getElapsedMs(state));
}
