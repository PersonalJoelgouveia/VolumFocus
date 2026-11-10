import { create } from 'zustand';

const EXEC_PRESETS = [30, 60, 90, 120, 180] as const;
const DEFAULT_REST = 90;

/** Segundos inteiros que faltam até `endAt` (arredonda para cima: 1,2s → 2). */
function secondsLeft(endAt: number | null): number {
  if (endAt === null) return 0;
  return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
}

/**
 * Estado do modal de execução & timer de descanso — sucessor de `execState`
 * + croTriggerRest/exec* (index.html ~6560-7064, ~10119). O snapshot de
 * "qual exercício está aberto" fica aqui (day/idx); os dados do exercício em
 * si (entry/exercise) continuam vivendo só em useWorkoutStore/useExerciseStore
 * e são lidos ao vivo pelos componentes — evita duplicar/desalinhar log.
 *
 * O tick NÃO mora aqui: fica num efeito local do <ExecutionModal> (mesmo padrão
 * do <TimerEngine> global), montado só enquanto o modal está aberto. O tempo é
 * calculado por timestamp (`endAt` vs Date.now()), nunca por contagem de ticks —
 * então ticks atrasados ou congelados em segundo plano não perdem tempo.
 */
interface ExecState {
  isOpen: boolean;
  day: number | null;
  idx: number | null;
  isCardio: boolean;
  totalSets: number;
  done: boolean[];
  current: number;
  restDuration: number;
  /** Segundos restantes exibidos — derivado de `endAt` a cada tick. */
  remaining: number;
  /** Instante absoluto (Date.now()) em que o descanso termina; `null` se parado.
   *  Fonte da verdade do tempo: sobrevive a timers atrasados/congelados em
   *  segundo plano, porque `tick()` recalcula a partir do relógio real. */
  endAt: number | null;
  running: boolean;
  alarming: boolean;
  editingSet: number | null;
  presets: readonly number[];

  /** Abre o modal para o exercício `idx` do dia `day`. */
  open: (day: number, idx: number, opts: { isCardio: boolean; totalSets: number }) => void;
  close: () => void;

  editSet: (k: number) => void;
  cancelEditSet: () => void;
  /** Chamado após o componente persistir os novos valores em useWorkoutStore. */
  finishEditSet: () => void;

  /** Alterna concluído/pendente da série k. Retorna o novo estado para o
   *  chamador decidir side-effects (toast, marcar exercício concluído). */
  toggleSet: (k: number) => { justCompleted: boolean; allDone: boolean };
  nextSet: () => number | null;

  ringSingleTap: () => void;
  startTimer: () => void;
  pauseTimer: () => void;
  stopTimer: () => void;
  resetTimer: () => void;
  stopAlarm: () => void;
  adjustRest: (delta: number) => void;
  setPreset: (sec: number) => void;

  /** Chamado a cada segundo por <ExecutionModal> enquanto running/alarming. */
  tick: () => { justFinished: boolean };
}

export const useExecStore = create<ExecState>()((set, get) => ({
  isOpen: false,
  day: null,
  idx: null,
  isCardio: false,
  totalSets: 0,
  done: [],
  current: 0,
  restDuration: DEFAULT_REST,
  remaining: DEFAULT_REST,
  endAt: null,
  running: false,
  alarming: false,
  editingSet: null,
  presets: EXEC_PRESETS,

  open: (day, idx, { isCardio, totalSets }) =>
    set({
      isOpen: true,
      day,
      idx,
      isCardio,
      totalSets: isCardio ? 0 : totalSets,
      done: Array(isCardio ? 0 : totalSets).fill(false),
      current: 0,
      restDuration: DEFAULT_REST,
      remaining: DEFAULT_REST,
      endAt: null,
      running: false,
      alarming: false,
      editingSet: null,
    }),

  close: () => set({ isOpen: false, running: false, alarming: false, endAt: null }),

  editSet: (k) => set({ editingSet: k }),
  cancelEditSet: () => set({ editingSet: null }),
  finishEditSet: () => set({ editingSet: null }),

  toggleSet: (k) => {
    const s = get();
    if (s.isCardio || k < 0 || k >= s.totalSets) return { justCompleted: false, allDone: false };
    const wasDone = s.done[k];
    const done = [...s.done];
    done[k] = !wasDone;
    const nextPending = done.findIndex((d) => !d);
    const current = nextPending === -1 ? s.totalSets : nextPending;
    set({ done, current });
    const allDone = current >= s.totalSets;
    return { justCompleted: !wasDone, allDone };
  },

  nextSet: () => {
    const s = get();
    if (s.isCardio || s.current >= s.totalSets) return null;
    return s.current;
  },

  ringSingleTap: () => {
    const s = get();
    if (s.alarming) {
      get().stopAlarm();
      return;
    }
    if (s.running) {
      get().pauseTimer();
    } else {
      get().startTimer();
    }
  },

  startTimer: () => {
    const s = get();
    if (s.running) return;
    const remaining = s.remaining <= 0 ? s.restDuration : s.remaining;
    // Começar de novo silencia um alarme que ainda esteja tocando.
    set({ remaining, endAt: Date.now() + remaining * 1000, running: true, alarming: false });
  },

  pauseTimer: () => {
    const s = get();
    // Congela o valor real (pelo relógio), não o último valor exibido.
    set({ remaining: s.running ? secondsLeft(s.endAt) : s.remaining, endAt: null, running: false });
  },

  stopTimer: () => set({ running: false, endAt: null }),

  resetTimer: () => {
    const s = get();
    set({ running: false, alarming: false, endAt: null, remaining: s.restDuration });
  },

  stopAlarm: () => set({ alarming: false }),

  adjustRest: (delta) => {
    const s = get();
    const newDuration = Math.max(10, Math.min(600, s.restDuration + delta));
    const applied = newDuration - s.restDuration;
    if (s.running && s.endAt !== null) {
      // Rodando: desloca o instante final e reconta pelo relógio.
      const endAt = s.endAt + applied * 1000;
      set({ restDuration: newDuration, endAt, remaining: Math.max(0, Math.min(newDuration, secondsLeft(endAt))) });
      return;
    }
    set({
      restDuration: newDuration,
      remaining: Math.max(0, Math.min(newDuration, s.remaining + applied)),
    });
  },

  setPreset: (sec) => set({ running: false, endAt: null, restDuration: sec, remaining: sec }),

  tick: () => {
    const s = get();
    if (!s.running || s.endAt === null) return { justFinished: false };
    const remaining = secondsLeft(s.endAt);
    if (remaining <= 0) {
      set({ remaining: 0, running: false, endAt: null, alarming: true });
      return { justFinished: true };
    }
    if (remaining !== s.remaining) set({ remaining });
    return { justFinished: false };
  },
}));
