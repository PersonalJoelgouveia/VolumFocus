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
 * `useWorkoutStore`/`useExerciseStore` (dados reais de exercício).
 *
 * A partir desta etapa o protocolo é uma sequência livre de estímulos
 * (`config.stimuli`) — cada um com nome, tipo (Preparação/Exercício/
 * Descanso/Outro) e duração própria, editável/reordenável na área
 * "Configurar Timer" (ver TimerConfigForm.tsx). O Timer executa a
 * sequência exatamente na ordem do array, uma única vez, do primeiro ao
 * último item — sem repetição implícita de "séries" (isso já foi
 * substituído: quem quiser repetir um bloco agora adiciona os estímulos
 * quantas vezes quiser na sequência).
 */
export type StimulusType = 'preparacao' | 'exercicio' | 'descanso' | 'outro';

export interface Stimulus {
  id: string;
  name: string;
  type: StimulusType;
  durationSeconds: number;
}

export interface TimerConfig {
  name: string;
  stimuli: Stimulus[];
}

export function genStimulusId(): string {
  return `stim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const DEFAULT_CONFIG: TimerConfig = {
  name: 'Meu Timer',
  stimuli: [
    { id: genStimulusId(), name: 'Preparação', type: 'preparacao', durationSeconds: 10 },
    { id: genStimulusId(), name: 'Agachamento', type: 'exercicio', durationSeconds: 30 },
    { id: genStimulusId(), name: 'Descanso', type: 'descanso', durationSeconds: 15 },
    { id: genStimulusId(), name: 'Flexão', type: 'exercicio', durationSeconds: 30 },
    { id: genStimulusId(), name: 'Descanso', type: 'descanso', durationSeconds: 15 },
    { id: genStimulusId(), name: 'Burpee', type: 'exercicio', durationSeconds: 30 },
  ],
};

interface IntervalTimerState {
  config: TimerConfig;
  /** Índice (0-based) do estímulo em execução em `config.stimuli`. null =
   *  ainda não iniciado, ou já concluído (ver `finished`). */
  currentIndex: number | null;
  finished: boolean;

  startedAt: number | null;
  pausedAt: number | null;
  pausedMs: number;

  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  /** Salva a configuração (nome + sequência de estímulos) e inicia
   *  imediatamente do primeiro estímulo, chamado pelo botão "Salvar Timer"
   *  da área Configurar Timer. */
  saveAndStart: (config: TimerConfig) => void;
  /** Chamado pelo efeito local do componente quando o tempo do estímulo
   *  atual se esgota — avança pro próximo item da sequência, ou finaliza
   *  se já era o último. */
  advance: () => void;
}

export const useIntervalTimerStore = create<IntervalTimerState>()((set, get) => ({
  config: DEFAULT_CONFIG,
  currentIndex: null,
  finished: false,
  startedAt: null,
  pausedAt: null,
  pausedMs: 0,

  start: () => {
    const s = get();
    if (s.config.stimuli.length === 0) return;
    set({ currentIndex: 0, finished: false, startedAt: Date.now(), pausedAt: null, pausedMs: 0 });
  },

  pause: () => {
    const s = get();
    if (s.currentIndex === null || s.pausedAt || s.finished) return;
    set({ pausedAt: Date.now() });
  },

  resume: () => {
    const s = get();
    if (!s.pausedAt) return;
    set({ pausedMs: s.pausedMs + (Date.now() - s.pausedAt), pausedAt: null });
  },

  reset: () => set({ currentIndex: null, finished: false, startedAt: null, pausedAt: null, pausedMs: 0 }),

  saveAndStart: (config) => {
    if (config.stimuli.length === 0) return;
    set({
      config,
      currentIndex: 0,
      finished: false,
      startedAt: Date.now(),
      pausedAt: null,
      pausedMs: 0,
    });
  },

  advance: () => {
    const s = get();
    if (s.currentIndex === null || s.finished) return;
    const nextIndex = s.currentIndex + 1;
    if (nextIndex >= s.config.stimuli.length) {
      set({ finished: true, currentIndex: null, pausedAt: null });
      return;
    }
    set({ currentIndex: nextIndex, startedAt: Date.now(), pausedAt: null, pausedMs: 0 });
  },
}));

/** Tempo decorrido no estímulo atual (ms), descontando pausas. */
export function getElapsedMs(state: IntervalTimerState): number {
  if (!state.startedAt) return 0;
  const now = state.pausedAt ?? Date.now();
  return now - state.startedAt - state.pausedMs;
}

/** Tempo restante no estímulo atual (ms), já limitado a [0, duração do estímulo]. */
export function getRemainingMs(state: IntervalTimerState): number {
  if (state.currentIndex === null) return 0;
  const stim = state.config.stimuli[state.currentIndex];
  if (!stim) return 0;
  return Math.max(0, stim.durationSeconds * 1000 - getElapsedMs(state));
}
