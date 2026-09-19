import { useEffect, useState } from 'react';
import {
  getRemainingMs,
  useIntervalTimerStore,
  type StimulusType,
  type TimerConfig,
} from '../../store/useIntervalTimerStore';
import { TimerConfigForm } from './TimerConfigForm';
import './TimerToolView.css';

const RING_R = 88;
const RING_C = 2 * Math.PI * RING_R;

const TYPE_LABEL: Record<StimulusType, string> = {
  preparacao: 'Preparação',
  exercicio: 'Exercício',
  descanso: 'Descanso',
  outro: 'Outro',
};

function fmt(ms: number) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type ToolScreen = 'ring' | 'config';

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
 * último item, uma única vez — cada item já carrega seu próprio nome,
 * tipo (Preparação/Exercício/Descanso/Outro) e duração, então não há mais
 * lógica implícita de "rounds"/"séries" fixas aqui.
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

  const isIdle = currentIndex === null && !finished;
  const isRunning = currentIndex !== null && !pausedAt && !finished;
  const isPaused = currentIndex !== null && !!pausedAt && !finished;

  // Tick local por timestamp — mesmo padrão do useCooperTimerStore (ver
  // CardioTestPanel), escopado à vida desta tela, sem setInterval global.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      const remaining = getRemainingMs(useIntervalTimerStore.getState());
      if (remaining <= 0) {
        useIntervalTimerStore.getState().advance();
        if (navigator.vibrate) {
          try {
            navigator.vibrate(120);
          } catch {
            /* vibração indisponível */
          }
        }
      }
      forceTick((n) => n + 1);
    }, 250);
    return () => clearInterval(id);
  }, [isRunning]);

  if (screen === 'config') {
    return (
      <div className="itv-view">
        <button type="button" className="btn btn-ghost itv-back" onClick={() => setScreen('ring')}>
          ← Voltar
        </button>
        <TimerConfigForm
          config={config}
          onCancel={() => setScreen('ring')}
          onSave={(next: TimerConfig) => {
            saveAndStart(next);
            setScreen('ring');
          }}
        />
      </div>
    );
  }

  const total = config.stimuli.length;
  const current = currentIndex !== null ? config.stimuli[currentIndex] : (config.stimuli[0] ?? null);
  const next = currentIndex !== null ? config.stimuli[currentIndex + 1] : undefined;

  const remainingMs = currentIndex !== null ? getRemainingMs(useIntervalTimerStore.getState()) : 0;
  const durationMs = current ? current.durationSeconds * 1000 : 0;
  const progress = isIdle || finished || durationMs === 0 ? 1 : remainingMs / durationMs;

  const stateLabel = finished ? 'Concluído' : current ? TYPE_LABEL[current.type] : 'Pronto pra começar';
  const currentLabel = current?.name ?? '—';
  const nextLabel = finished ? '—' : next ? next.name : total > 0 ? 'Fim' : '—';
  const centerTime = isIdle
    ? fmt((config.stimuli[0]?.durationSeconds ?? 0) * 1000)
    : finished
      ? '00:00'
      : fmt(remainingMs);

  const ringPhaseClass = finished
    ? 'itv-ring-finished'
    : current
      ? `itv-ring-${current.type}`
      : 'itv-ring-idle';

  return (
    <div className="itv-view">
      <div className="itv-header-row">
        <button type="button" className="btn btn-ghost itv-back" onClick={onVoltar}>
          ← Voltar
        </button>
        <button type="button" className="btn btn-ghost itv-config-btn" onClick={() => setScreen('config')}>
          ⚙ Configurar Timer
        </button>
      </div>

      <div className="itv-card">
        <div className="itv-name">{config.name}</div>
        <div className="itv-round-badge">
          Estímulo {Math.min((currentIndex ?? 0) + 1, total)} de {total}
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
          <div className="itv-stimulus-block">
            <div className="itv-stimulus-tag">Estímulo atual</div>
            <div className="itv-stimulus-name">{currentLabel}</div>
          </div>
          <div className="itv-stimulus-block itv-stimulus-next">
            <div className="itv-stimulus-tag">Próximo</div>
            <div className="itv-stimulus-name">{nextLabel}</div>
          </div>
        </div>

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
