import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { genStimulusId, type Stimulus, type TimerConfig } from './useIntervalTimerStore';

/**
 * Biblioteca de Timers salvos (Ferramentas > Timer > Biblioteca) —
 * persistida (jg3_timer_library, mesmo padrão do useThemeStore), separada
 * da config "ativa" em useIntervalTimerStore. Cada entrada é um
 * `TimerConfig` completo (mesmo tipo usado pelo Timer personalizado e por
 * `TimerConfigForm`) — os presets abaixo usam exatamente esse motor,
 * nenhuma estrutura paralela.
 */
export interface SavedTimer {
  id: string;
  config: TimerConfig;
}

function genTimerId(): string {
  return `tl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface BuildIntervalOpts {
  prepSeconds?: number;
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  workLabel?: string;
  restLabel?: string;
}

/** Gera Preparação (opcional) + N rodadas de Exercício/Descanso alternados
 *  — usado pelos presets Tabata/HIIT abaixo. */
function buildIntervalStimuli(opts: BuildIntervalOpts): Stimulus[] {
  const { prepSeconds = 0, rounds, workSeconds, restSeconds, workLabel = 'Exercício', restLabel = 'Descanso' } = opts;
  const stimuli: Stimulus[] = [];
  if (prepSeconds > 0) {
    stimuli.push({ id: genStimulusId(), name: 'Preparação', type: 'preparacao', durationSeconds: prepSeconds });
  }
  for (let i = 0; i < rounds; i++) {
    stimuli.push({ id: genStimulusId(), name: workLabel, type: 'exercicio', durationSeconds: workSeconds });
    if (restSeconds > 0) {
      stimuli.push({ id: genStimulusId(), name: restLabel, type: 'descanso', durationSeconds: restSeconds });
    }
  }
  return stimuli;
}

function buildCircuitoStimuli(): Stimulus[] {
  const stations = ['Agachamento', 'Flexão', 'Afundo', 'Prancha', 'Burpee'];
  const stimuli: Stimulus[] = [
    { id: genStimulusId(), name: 'Preparação', type: 'preparacao', durationSeconds: 10 },
  ];
  stations.forEach((name) => {
    stimuli.push({ id: genStimulusId(), name, type: 'exercicio', durationSeconds: 40 });
    stimuli.push({ id: genStimulusId(), name: 'Descanso', type: 'descanso', durationSeconds: 15 });
  });
  return stimuli;
}

/** Presets iniciais — semeados só na primeira vez (ver `timers` abaixo);
 *  depois disso a lista persistida manda (editar/duplicar/excluir ficam
 *  disponíveis pra eles como pra qualquer timer salvo). */
function buildPresets(): SavedTimer[] {
  return [
    {
      id: 'preset-tabata',
      config: { name: 'Tabata', stimuli: buildIntervalStimuli({ prepSeconds: 10, rounds: 8, workSeconds: 20, restSeconds: 10 }) },
    },
    {
      id: 'preset-hiit-30-30',
      config: { name: 'HIIT 30/30', stimuli: buildIntervalStimuli({ prepSeconds: 10, rounds: 8, workSeconds: 30, restSeconds: 30 }) },
    },
    {
      id: 'preset-hiit-40-20',
      config: { name: 'HIIT 40/20', stimuli: buildIntervalStimuli({ prepSeconds: 10, rounds: 8, workSeconds: 40, restSeconds: 20 }) },
    },
    {
      id: 'preset-circuito',
      config: { name: 'Circuito', stimuli: buildCircuitoStimuli() },
    },
    {
      id: 'preset-simples',
      config: { name: 'Timer simples', stimuli: [{ id: genStimulusId(), name: 'Timer', type: 'outro', durationSeconds: 60 }] },
    },
  ];
}

interface TimerLibraryState {
  timers: SavedTimer[];
  /** Cria uma entrada nova, ou atualiza a existente se `id` já estiver na
   *  biblioteca. Retorna o id salvo. */
  save: (config: TimerConfig, id?: string) => string;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
}

export const useTimerLibraryStore = create<TimerLibraryState>()(
  persist(
    (set, get) => ({
      timers: buildPresets(),

      save: (config, id) => {
        const targetId = id ?? genTimerId();
        const s = get();
        const exists = s.timers.some((t) => t.id === targetId);
        const timers = exists
          ? s.timers.map((t) => (t.id === targetId ? { id: targetId, config } : t))
          : [...s.timers, { id: targetId, config }];
        set({ timers });
        return targetId;
      },

      duplicate: (id) => {
        const s = get();
        const original = s.timers.find((t) => t.id === id);
        if (!original) return;
        const copy: SavedTimer = {
          id: genTimerId(),
          config: {
            name: `${original.config.name} (cópia)`,
            stimuli: original.config.stimuli.map((stim) => ({ ...stim, id: genStimulusId() })),
          },
        };
        set({ timers: [...s.timers, copy] });
      },

      remove: (id) => {
        const s = get();
        set({ timers: s.timers.filter((t) => t.id !== id) });
      },
    }),
    { name: 'jg3_timer_library' },
  ),
);

/** Duração total (s) de um timer salvo — soma das durações de todos os estímulos. */
export function getTotalSeconds(config: TimerConfig): number {
  return config.stimuli.reduce((sum, s) => sum + s.durationSeconds, 0);
}

/** Nº de séries "quando aplicável" — contagem de estímulos do tipo
 *  Exercício (0 quando o timer não tem nenhum, ex.: Timer simples). */
export function getSeriesCount(config: TimerConfig): number {
  return config.stimuli.filter((s) => s.type === 'exercicio').length;
}
