import { useEffect, useRef, useState } from 'react';
import {
  getRemainingMs,
  useIntervalTimerStore,
  type StimulusType,
  type TimerConfig,
} from '../../store/useIntervalTimerStore';
import { useTimerAudioStore } from '../../store/useTimerAudioStore';
import { useTimerLibraryStore, type SavedTimer } from '../../store/useTimerLibraryStore';
import { playSound } from '../../utils/timerSounds';
import { TimerConfigForm } from './TimerConfigForm';
import { TimerAudioSettings } from './TimerAudioSettings';
import { TimerLibrary } from './TimerLibrary';
import './TimerToolView.css';

const RING_R = 88;
const RING_C = 2 * Math.PI * RING_R;

const TYPE_LABEL: Record<StimulusType, string> = {
  preparacao: 'Preparação',
  exercicio: 'Exercício',
  descanso: 'Descanso',
  outro: 'Outro',
};

type SeqStatus = 'done' | 'atual' | 'proximo' | 'futuro';

const SEQ_ICON: Record<SeqStatus, string> = {
  done: '✓',
  atual: '▶',
  proximo: '→',
  futuro: '○',
};

const SEQ_STATUS_LABEL: Record<SeqStatus, string> = {
  done: 'Concluído',
  atual: 'Atual',
  proximo: 'Próximo',
  futuro: 'Futuro',
};

function fmt(ms: number) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type ToolScreen = 'ring' | 'config' | 'audio' | 'library';

/**
 * Timer de intervalos com sequência livre de estímulos — sucessor
 * funcional do card "Timer" do hub Ferramentas. Reaproveita tecnicamente o
 * mesmo padrão de anel circular já usado no timer de descanso do
 * ExecutionModal (RING_R/RING_C + <svg>/<circle> com strokeDasharray/
 * strokeDashoffset, ver components/registro/ExecutionModal.tsx) e o mesmo
 * padrão de tick local por timestamp do useCooperTimerStore (ver
 * components/cardio/CardioTestPanel.tsx) — sem depender de nenhum dos dois
 * componentes/stores. `useIntervalTimerStore` é isolado: nenhuma relação
 * com `useTimerStore` (cronômetro de treino) nem com dados reais de
 * exercício/musculação.
 *
 * A sequência (`config.stimuli`) é executada exatamente na ordem
 * cadastrada em "Configurar Timer" (`TimerConfigForm`), do primeiro ao
 * último item, uma única vez. Abaixo do anel: os cards "Estímulo atual"
 * (nome + tempo restante, ao vivo) e "Próximo" (nome + duração própria), e
 * a lista completa da sequência com status por item (✓ concluído /
 * ▶ atual / → próximo / ○ futuro) — tudo derivado só de `currentIndex`,
 * `finished` e `config.stimuli`, então atualiza sozinho a cada tick, sem
 * estado próprio duplicado. A linha "atual" tem scrollIntoView pra manter
 * leitura rápida mesmo em sequências longas/telas pequenas.
 *
 * Áudio/vibração (`useTimerAudioStore`, configurado em
 * `TimerAudioSettings`): ao entrar num novo estímulo, toca o som de
 * "Início" se o tipo não for Descanso, ou o de "Final/Descanso" se for
 * (marca o fim do estímulo anterior); nos últimos 3s de qualquer estímulo,
 * toca o bipe de contagem regressiva se habilitado. Vibração acompanha os
 * mesmos gatilhos quando suportada (`navigator.vibrate`). Sons gerados via
 * Web Audio API nativa (ver utils/timerSounds.ts) — sem arquivos de áudio
 * nem libs novas.
 *
 * Biblioteca de Timers (`useTimerLibraryStore`, tela `TimerLibrary`):
 * "Salvar Timer" em `TimerConfigForm` sempre persiste na biblioteca — cria
 * uma entrada nova ou atualiza a que estiver sendo editada
 * (`editingLibraryId`) — além de já iniciar o protocolo salvo, como antes.
 * Iniciar/Editar um item da biblioteca só troca `configFormSource`/
 * `editingLibraryId` e delega pro mesmo motor (`saveAndStart`/
 * `TimerConfigForm`) — os presets (Tabata, HIIT 30/30, HIIT 40/20,
 * Circuito, Timer simples) são `TimerConfig` comuns, sem estrutura
 * paralela.
 */
export function TimerToolView({ onVoltar }: { onVoltar: () => void }) {
  const config = useIntervalTimerStore((s) => s.config);
  const currentIndex = useIntervalTimerStore((s) => s.currentIndex);
  const finished = useIntervalTimerStore((s) => s.finished);
  const pausedAt = useIntervalTimerStore((s) => s.pausedAt);
  const start = useIntervalTimerStore((s) => s.start);
  const pause = useIntervalTimerStore((s) => s.pause);
  const resume = useIntervalTimerStore((s) => s.resume);
  const reset = useIntervalTimerStore((s) => s.reset);
  const saveAndStart = useIntervalTimerStore((s) => s.saveAndStart);

  const [screen, setScreen] = useState<ToolScreen>('ring');
  const [configFormSource, setConfigFormSource] = useState<TimerConfig>(config);
  const [editingLibraryId, setEditingLibraryId] = useState<string | undefined>(undefined);
  const activeRowRef = useRef<HTMLDivElement | null>(null);
  const lastCountdownSecondRef = useRef<number | null>(null);

  const isIdle = currentIndex === null && !finished;
  const isRunning = currentIndex !== null && !pausedAt && !finished;
  const isPaused = currentIndex !== null && !!pausedAt && !finished;

  function vibrate(pattern: number | number[]) {
    if (!useTimerAudioStore.getState().vibrationEnabled || !navigator.vibrate) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      /* vibração indisponível */
    }
  }

  // Tick local por timestamp — mesmo padrão do useCooperTimerStore (ver
  // CardioTestPanel), escopado à vida desta tela, sem setInterval global.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      const remaining = getRemainingMs(useIntervalTimerStore.getState());
      const audio = useTimerAudioStore.getState();

      if (remaining > 0 && audio.finalCountdownEnabled) {
        const remainingSec = Math.ceil(remaining / 1000);
        if (remainingSec <= 3 && lastCountdownSecondRef.current !== remainingSec) {
          lastCountdownSecondRef.current = remainingSec;
          playSound('tick', audio.volume);
          vibrate(40);
        }
      }

      if (remaining <= 0) {
        useIntervalTimerStore.getState().advance();
        lastCountdownSecondRef.current = null;
        const newState = useIntervalTimerStore.getState();
        const newCurrent = newState.currentIndex !== null ? newState.config.stimuli[newState.currentIndex] : null;
        if (newCurrent) {
          if (newCurrent.type === 'descanso') {
            if (audio.endEnabled) playSound(audio.endSound, audio.volume);
          } else if (audio.startEnabled) {
            playSound(audio.startSound, audio.volume);
          }
        }
        vibrate(120);
      }
      forceTick((n) => n + 1);
    }, 250);
    return () => clearInterval(id);
  }, [isRunning]);

  // Mantém a linha "atual" (ou a próxima, em preview) visível na lista da
  // sequência conforme o Timer avança — sem exigir scroll manual.
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentIndex]);

  if (screen === 'library') {
    return (
      <div className="itv-view">
        <TimerLibrary
          onVoltar={() => setScreen('ring')}
          onNew={() => {
            setConfigFormSource({ name: '', stimuli: [] });
            setEditingLibraryId(undefined);
            setScreen('config');
          }}
          onEdit={(timer: SavedTimer) => {
            setConfigFormSource(timer.config);
            setEditingLibraryId(timer.id);
            setScreen('config');
          }}
          onStart={(timer: SavedTimer) => {
            saveAndStart(timer.config);
            setEditingLibraryId(timer.id);
            setScreen('ring');
          }}
        />
      </div>
    );
  }

  if (screen === 'audio') {
    return (
      <div className="itv-view">
        <TimerAudioSettings onVoltar={() => setScreen('ring')} />
      </div>
    );
  }

  if (screen === 'config') {
    return (
      <div className="itv-view">
        <button type="button" className="btn btn-ghost itv-back" onClick={() => setScreen('ring')}>
          ← Voltar
        </button>
        <TimerConfigForm
          config={configFormSource}
          onCancel={() => setScreen('ring')}
          onSave={(next: TimerConfig) => {
            const savedId = useTimerLibraryStore.getState().save(next, editingLibraryId);
            setEditingLibraryId(savedId);
            saveAndStart(next);
            setScreen('ring');
          }}
        />
      </div>
    );
  }

  const total = config.stimuli.length;
  const previewIndex = currentIndex ?? 0;
  const current = config.stimuli[previewIndex] ?? null;
  const next = finished ? undefined : config.stimuli[previewIndex + 1];

  const remainingMs = currentIndex !== null ? getRemainingMs(useIntervalTimerStore.getState()) : 0;
  const durationMs = current ? current.durationSeconds * 1000 : 0;
  const progress = isIdle || finished || durationMs === 0 ? 1 : remainingMs / durationMs;

  const stateLabel = finished ? 'Concluído' : current ? TYPE_LABEL[current.type] : 'Pronto pra começar';
  const currentLabel = current?.name ?? '—';
  const nextLabel = next ? next.name : total > 0 ? 'Fim' : '—';
  const currentTimeLabel = isIdle
    ? fmt((current?.durationSeconds ?? 0) * 1000)
    : finished
      ? '00:00'
      : fmt(remainingMs);
  const nextTimeLabel = next ? fmt(next.durationSeconds * 1000) : '—';
  const centerTime = currentTimeLabel;

  const ringPhaseClass = finished
    ? 'itv-ring-finished'
    : current
      ? `itv-ring-${current.type}`
      : 'itv-ring-idle';

  function statusFor(i: number): SeqStatus {
    if (finished) return 'done';
    if (currentIndex === null) return i === 0 ? 'proximo' : 'futuro';
    if (i < currentIndex) return 'done';
    if (i === currentIndex) return 'atual';
    if (i === currentIndex + 1) return 'proximo';
    return 'futuro';
  }

  return (
    <div className="itv-view">
      <div className="itv-header-row">
        <button type="button" className="btn btn-ghost itv-back" onClick={onVoltar}>
          ← Voltar
        </button>
        <div className="itv-header-actions">
          <button type="button" className="btn btn-ghost itv-config-btn" onClick={() => setScreen('library')}>
            📚 Biblioteca
          </button>
          <button type="button" className="btn btn-ghost itv-config-btn" onClick={() => setScreen('audio')}>
            🔊 Áudio
          </button>
          <button
            type="button"
            className="btn btn-ghost itv-config-btn"
            onClick={() => {
              setConfigFormSource(config);
              setScreen('config');
            }}
          >
            ⚙ Configurar Timer
          </button>
        </div>
      </div>

      <div className="itv-card">
        <div className="itv-name">{config.name}</div>
        <div className="itv-round-badge">
          Estímulo {Math.min(previewIndex + 1, total)} de {total}
        </div>

        <div className={`itv-ring ${ringPhaseClass}`}>
          <svg className="itv-ring-svg" viewBox="0 0 200 200">
            <circle className="itv-ring-bg" cx="100" cy="100" r={RING_R} />
            <circle
              className="itv-ring-prog"
              cx="100"
              cy="100"
              r={RING_R}
              style={{ strokeDasharray: `${RING_C} ${RING_C}`, strokeDashoffset: `${RING_C * (1 - progress)}` }}
            />
          </svg>
          <div className="itv-ring-center">
            <div className="itv-ring-time">{centerTime}</div>
            <div className="itv-ring-label">{stateLabel}</div>
          </div>
        </div>

        <div className="itv-dots">
          {config.stimuli.map((stim, i) => (
            <span
              key={stim.id}
              className={`itv-dot${i === currentIndex ? ' itv-dot-active' : ''}${currentIndex !== null && i < currentIndex ? ' itv-dot-done' : ''}`}
            />
          ))}
        </div>

        <div className="itv-stimuli-row">
          <div className="itv-stimulus-block itv-stimulus-current">
            <div className="itv-stimulus-tag">Estímulo atual</div>
            <div className="itv-stimulus-name">{currentLabel}</div>
            <div className="itv-stimulus-time">{currentTimeLabel}</div>
          </div>
          <div className="itv-stimulus-block itv-stimulus-next">
            <div className="itv-stimulus-tag">Próximo</div>
            <div className="itv-stimulus-name">{nextLabel}</div>
            <div className="itv-stimulus-time">{nextTimeLabel}</div>
          </div>
        </div>

        {total > 0 && (
          <div className="itv-seq-list">
            {config.stimuli.map((stim, i) => {
              const status = statusFor(i);
              const isActiveRow = status === 'atual' || (isIdle && status === 'proximo');
              return (
                <div
                  key={stim.id}
                  ref={isActiveRow ? activeRowRef : undefined}
                  className={`itv-seq-row itv-seq-${status}`}
                  aria-label={`${SEQ_STATUS_LABEL[status]}: ${stim.name}, ${fmt(stim.durationSeconds * 1000)}`}
                >
                  <span className="itv-seq-icon" aria-hidden="true">
                    {SEQ_ICON[status]}
                  </span>
                  <span className="itv-seq-name">{stim.name}</span>
                  <span className="itv-seq-time">{fmt(stim.durationSeconds * 1000)}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="itv-controls">
          {isIdle && (
            <button type="button" className="btn btn-primary itv-ctrl-btn" onClick={start} disabled={total === 0}>
              ▶ Iniciar
            </button>
          )}
          {isRunning && (
            <button type="button" className="btn btn-primary itv-ctrl-btn" onClick={pause}>
              ⏸ Pausar
            </button>
          )}
          {isPaused && (
            <button type="button" className="btn btn-primary itv-ctrl-btn" onClick={resume}>
              ▶ Continuar
            </button>
          )}
          {(isRunning || isPaused || finished) && (
            <button type="button" className="btn btn-ghost itv-ctrl-btn" onClick={reset}>
              ⟲ Reiniciar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
