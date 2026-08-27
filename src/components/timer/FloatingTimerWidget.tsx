import { useTimerStore } from '../../store/useTimerStore';
import { useCalorieStore } from '../../store/useCalorieStore';
import { useUIStore } from '../../store/useUIStore';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { useExecStore } from '../../store/useExecStore';
import { isCardioLogEntry } from '../../types/workout';
import { formatDuration } from '../../utils/timeFormat';
import './FloatingTimerWidget.css';

/**
 * Widget flutuante do cronômetro global — sucessor de `#cro-widget`
 * (index.html ~3543-3574 + funções croTogglePanel/croPauseResume/croStop).
 * Só renderiza quando o cronômetro está rodando ou pausado (equivale a
 * `.cro-visible`).
 */
export function FloatingTimerWidget() {
  const isRunning = useTimerStore((s) => s.isRunning);
  const isPaused = useTimerStore((s) => s.isPaused);
  const displaySeconds = useTimerStore((s) => s.displaySeconds);
  const isPanelOpen = useTimerStore((s) => s.isPanelOpen);
  const togglePanel = useTimerStore((s) => s.togglePanel);
  const pauseResume = useTimerStore((s) => s.pauseResume);
  const stop = useTimerStore((s) => s.stop);
  const startRest = useTimerStore((s) => s.startRest);

  const calcKcal = useCalorieStore((s) => s.calcKcal);
  const showToast = useUIStore((s) => s.showToast);

  const selectedDay = useWorkoutStore((s) => s.selectedDay);
  const getDayLog = useWorkoutStore((s) => s.getDayLog);
  const isExerciseDone = useWorkoutStore((s) => s.isExerciseDone);
  const openExec = useExecStore((s) => s.open);

  const isVisible = isRunning || isPaused;
  if (!isVisible) return null;

  const timeStr = formatDuration(displaySeconds);
  const kcal = calcKcal(displaySeconds);

  function handleStop() {
    const liveSeconds = stop();
    const finalKcal = calcKcal(liveSeconds);
    const kcalStr = finalKcal !== null ? ` · 🔥 ${finalKcal.toFixed(0)} kcal` : '';
    showToast(`⏱️ Treino encerrado — ${formatDuration(liveSeconds)}${kcalStr}`);
    // Pendente Fase 4: checagem de conquista "Fornalha Calórica" (ach.checkFornalha).
  }

  /**
   * Sucessor de croTriggerRest() (index.html ~10119-10143): acha o próximo
   * exercício não concluído do dia (a partir do que estiver aberto no
   * momento, dando a volta se necessário) e abre o modal de execução nele
   * já com o timer de descanso rodando. Se o dia estiver vazio, cai no
   * fallback de 90s avulsos.
   */
  function handleRest() {
    const log = getDayLog(selectedDay);
    if (!log.length) {
      startRest(90);
      showToast('⏱️ Descanso de 90s iniciado.');
      return;
    }

    const current = useExecStore.getState().day === selectedDay ? (useExecStore.getState().idx ?? -1) : -1;
    let target = -1;
    for (let i = current + 1; i < log.length; i++) {
      if (!isExerciseDone(selectedDay, i)) {
        target = i;
        break;
      }
    }
    if (target === -1) {
      for (let i = 0; i <= current; i++) {
        if (!isExerciseDone(selectedDay, i)) {
          target = i;
          break;
        }
      }
    }
    if (target === -1) target = Math.max(0, current);

    const entry = log[target];
    togglePanel();
    if (isCardioLogEntry(entry)) {
      openExec(selectedDay, target, { isCardio: true, totalSets: 0 });
    } else {
      openExec(selectedDay, target, { isCardio: false, totalSets: entry.sets || 1 });
    }
    requestAnimationFrame(() => useExecStore.getState().startTimer());
  }

  return (
    <div className="cro-widget cro-visible">
      {isPanelOpen && (
        <div className="cro-panel cro-panel-open">
          <div className="cro-panel-time">{timeStr}</div>
          <div className="cro-panel-label">Tempo de Treino</div>
          {kcal !== null && (
            <div className="cro-kcal-row">
              <span className="cro-kcal-ico">🔥</span>
              <span>{kcal.toFixed(1)}</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 500 }}>kcal</span>
            </div>
          )}
          <div className="cro-sep" />
          <div className="cro-actions">
            <button className="cro-btn cro-btn-rest" onClick={handleRest}>
              ⏱️ Descanso
            </button>
            <button className="cro-btn" onClick={pauseResume}>
              {isRunning ? '⏸ Pausar' : '▶ Retomar'}
            </button>
          </div>
          <div className="cro-actions" style={{ marginTop: 0 }}>
            <button className="cro-btn cro-btn-stop" style={{ gridColumn: 'span 2' }} onClick={handleStop}>
              ⏹ Encerrar Treino
            </button>
          </div>
        </div>
      )}

      <div className="cro-pill" onClick={togglePanel}>
        <span className={`cro-dot${isRunning ? '' : ' cro-paused'}`} />
        <span className="cro-time">{timeStr}</span>
      </div>
    </div>
  );
}
