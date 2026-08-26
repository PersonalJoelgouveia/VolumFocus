import { create } from 'zustand';

/**
 * Cronômetro global de treino — migrado fielmente de `croState`
 * (index.html ~9942) e das funções croStart/croPauseResume/croStop/croAsk.
 *
 * O tick por segundo NÃO fica dentro deste store: fica no componente
 * <TimerEngine> (um único setInterval montado uma vez no AppShell), que
 * chama `tick()`. Isso reproduz o comportamento "global e em segundo
 * plano" do monolito (croState.timerId sobrevivia a qualquer troca de
 * view) sem duplicar intervals por componente.
 */
interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  /** Segundos acumulados até a última pausa/parada (equivale a croState.elapsed). */
  elapsedSeconds: number;
  /** Timestamp (ms) de quando a contagem atual começou a rodar (croState.startTs). */
  startTs: number | null;
  /** Segundos exibidos ao vivo, recalculados a cada tick (elapsed + tempo desde startTs). */
  displaySeconds: number;
  /** Já perguntou hoje se o usuário quer cronometrar (croState.askedToday). */
  askedToday: boolean;
  isConfirmModalOpen: boolean;
  isPanelOpen: boolean;

  /** Equivale a croAsk() — só abre se ainda não perguntou e não há cronômetro ativo. */
  askToStart: () => void;
  declineStart: () => void;
  /** Equivale a croStart(). */
  start: () => void;
  /** Equivale a croPauseResume(). */
  pauseResume: () => void;
  /** Equivale a croStop(). Retorna o tempo final em segundos para toast/conquistas. */
  stop: () => number;
  togglePanel: () => void;
  /** Recalcula displaySeconds a partir do relógio real — chamado pelo <TimerEngine>. */
  tick: () => void;

  /** Timer de descanso simplificado (croTriggerRest ficará completo na Fase 4,
   *  quando o modal de execução com exDone/execState existir). */
  restSecondsRemaining: number | null;
  startRest: (seconds: number) => void;
  clearRest: () => void;
}

export const useTimerStore = create<TimerState>()((set, get) => ({
  isRunning: false,
  isPaused: false,
  elapsedSeconds: 0,
  startTs: null,
  displaySeconds: 0,
  askedToday: false,
  isConfirmModalOpen: false,
  isPanelOpen: false,

  askToStart: () => {
    const s = get();
    if (s.askedToday || s.isRunning || s.isPaused) return;
    set({ askedToday: true, isConfirmModalOpen: true });
  },

  declineStart: () => set({ isConfirmModalOpen: false }),

  start: () =>
    set({
      isConfirmModalOpen: false,
      isRunning: true,
      isPaused: false,
      elapsedSeconds: 0,
      startTs: Date.now(),
      displaySeconds: 0,
    }),

  pauseResume: () => {
    const s = get();
    if (!s.isRunning && !s.isPaused) return;
    if (s.isRunning) {
      const live = s.elapsedSeconds + Math.floor((Date.now() - (s.startTs ?? Date.now())) / 1000);
      set({ elapsedSeconds: live, startTs: null, isRunning: false, isPaused: true, displaySeconds: live });
    } else {
      set({ startTs: Date.now(), isRunning: true, isPaused: false });
    }
  },

  stop: () => {
    const s = get();
    const live = s.isRunning
      ? s.elapsedSeconds + Math.floor((Date.now() - (s.startTs ?? Date.now())) / 1000)
      : s.elapsedSeconds;
    set({
      isRunning: false,
      isPaused: false,
      elapsedSeconds: 0,
      startTs: null,
      displaySeconds: 0,
      isPanelOpen: false,
      askedToday: false,
    });
    return live;
  },

  togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),

  tick: () => {
    const s = get();
    if (!s.isRunning || s.startTs === null) return;
    const live = s.elapsedSeconds + Math.floor((Date.now() - s.startTs) / 1000);
    set({ displaySeconds: live });
  },

  restSecondsRemaining: null,
  startRest: (seconds) => set({ restSecondsRemaining: seconds }),
  clearRest: () => set({ restSecondsRemaining: null }),
}));
