import { useEffect, useState } from 'react';
import {
  getRemainingMs,
  phaseDurationMs,
  useIntervalTimerStore,
  type TimerPhase,
} from '../../store/useIntervalTimerStore';
import './TimerToolView.css';

const RING_R = 88;
const RING_C = 2 * Math.PI * RING_R;

const PHASE_LABEL: Record<TimerPhase, string> = {
  preparacao: 'Preparação',
  exercicio: 'Exercício',
  descanso: 'Descanso',
};

function fmt(ms: number) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Timer de intervalos (Preparação → Exercício → Descanso, repetindo por
 * estímulo) — sucessor funcional do card "Timer" do hub Ferramentas.
 * Reaproveita tecnicamente o mesmo padrão de anel circular já usado no
 * timer de descanso do ExecutionModal (RING_R/RING_C + <svg>/<circle> com
 * strokeDasharray/strokeDashoffset, ver components/registro/ExecutionModal.tsx)
 * e o mesmo padrão de tick local por timestamp do useCooperTimerStore (ver
 * components/cardio/CardioTestPanel.tsx) — sem depender de nenhum dos dois
 * componentes/stores. `useIntervalTimerStore` é isolado: nenhuma relação
 * com `useTimerStore` (cronômetro de treino) nem com dados reais de
 * exercício/musculação. Nesta etapa as durações e a lista de estímulos são
 * fixas (ver useIntervalTimerStore.ts) — configuração avançada fica pra
 * uma etapa futura.
 */
export function TimerToolView({ onVoltar }: { onVoltar: () => void }) {
  const phase = useIntervalTimerStore((s) => s.phase);
  const roundIndex = useIntervalTimerStore((s) => s.roundIndex);
  const stimuli = useIntervalTimerStore((s) => s.stimuli);
  const finished = useIntervalTimerStore((s) => s.finished);
  const pausedAt = useIntervalTimerStore((s) => s.pausedAt);
  const start = useIntervalTimerStore((s) => s.start);
  const pause = useIntervalTimerStore((s) => s.pause);
  const resume = useIntervalTimerStore((s) => s.resume);
  const reset = useIntervalTimerStore((s) => s.reset);

  const isIdle = !phase && !finished;
  const isRunning = !!phase && !pausedAt && !finished;
  const isPaused = !!phase && !!pausedAt && !finished;

  // Tick local por timestamp — mesmo padrão do useCooperTimerStore (ver
  // CardioTestPanel), escopado à vida desta tela, sem setInterval global.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      const remaining = getRemainingMs(useIntervalTimerStore.getState());
      if (remaining <= 0) {
        useIntervalTimerStore.getState().advancePhase();
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

  const total = stimuli.length;
  const remainingMs = phase ? getRemainingMs(useIntervalTimerStore.getState()) : 0;
  const durationMs = phase ? phaseDurationMs(phase) : 0;
  const progress = isIdle || finished ? 1 : durationMs > 0 ? remainingMs / durationMs : 0;

  const stateLabel = finished ? 'Concluído' : phase ? PHASE_LABEL[phase] : 'Pronto pra começar';
  const currentStimulus = stimuli[roundIndex] ?? stimuli[0] ?? '—';
  const nextStimulus = finished ? '—' : roundIndex + 1 < total ? stimuli[roundIndex + 1] : 'Fim';
  const centerTime = isIdle ? fmt(phaseDurationMs('preparacao')) : finished ? '00:00' : fmt(remainingMs);

  const ringPhaseClass = finished ? 'itv-ring-finished' : phase ? `itv-ring-${phase}` : 'itv-ring-idle';

  return (
    <div className="itv-view">
      <button type="button" className="btn btn-ghost itv-back" onClick={onVoltar}>
        ← Voltar
      </button>

      <div className="itv-card">
        <div className="itv-round-badge">
          Estímulo {Math.min(roundIndex + 1, total)} de {total}
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
          {stimuli.map((_, i) => (
            <span
              key={i}
              className={`itv-dot${i === roundIndex && !isIdle ? ' itv-dot-active' : ''}${i < roundIndex ? ' itv-dot-done' : ''}`}
            />
          ))}
        </div>

        <div className="itv-stimuli-row">
          <div className="itv-stimulus-block">
            <div className="itv-stimulus-tag">Estímulo atual</div>
            <div className="itv-stimulus-name">{currentStimulus}</div>
          </div>
          <div className="itv-stimulus-block itv-stimulus-next">
            <div className="itv-stimulus-tag">Próximo</div>
            <div className="itv-stimulus-name">{nextStimulus}</div>
          </div>
        </div>

        <div className="itv-controls">
          {isIdle && (
            <button type="button" className="btn btn-primary itv-ctrl-btn" onClick={start}>
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
