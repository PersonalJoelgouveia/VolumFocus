import { useState } from 'react';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { useExerciseStore } from '../../store/useExerciseStore';
import { useUIStore } from '../../store/useUIStore';
import { DAYS, DAYS_SHORT, isCardioLogEntry } from '../../types/workout';
import { totalDaySets } from '../../utils/volumeCalc';
import './CloneDayModal.css';

const MODAL_ID = 'clone-day';

/**
 * Sucessor de openCloneDayModal()/confirmCloneDay() (index.html
 * ~6445-6560). Clona sempre a partir do dia atualmente selecionado
 * (`selectedDay`), com preview dos exercícios e grid de dias destino —
 * o dia de origem fica desabilitado no grid, igual ao original.
 *
 * "Modo append": os exercícios clonados são adicionados ao final do log
 * do dia destino, sem apagar o que já existe lá (mesma semântica de
 * `[...destLog, ...clones]`).
 */
export function CloneDayModal() {
  const openModalId = useUIStore((s) => s.openModalId);
  const closeModal = useUIStore((s) => s.closeModal);
  const showToast = useUIStore((s) => s.showToast);
  const isOpen = openModalId === MODAL_ID;

  const selectedDay = useWorkoutStore((s) => s.selectedDay);
  const weekLog = useWorkoutStore((s) => s.weekLog);
  const setDayLog = useWorkoutStore((s) => s.setDayLog);
  const exercises = useExerciseStore((s) => s.exercises);

  const [targetDay, setTargetDay] = useState<number | null>(null);

  if (!isOpen) return null;

  const sourceLog = weekLog[selectedDay] ?? [];

  function handleConfirm() {
    if (targetDay === null) return;
    // Deep clone completo — inclui séries, reps, carga, cardio, notas e
    // groupId/groupType (mesma fidelidade do JSON.parse(JSON.stringify())
    // do monolito: se o dia de origem tinha grupos, os clones mantêm o
    // mesmo groupId por dentro do próprio array de destino).
    const clones = structuredClone(sourceLog);
    const destLog = weekLog[targetDay] ?? [];
    setDayLog(targetDay, [...destLog, ...clones]);
    showToast(`${clones.length} exercícios clonados para ${DAYS[targetDay]}.`, 'success');
    setTargetDay(null);
    closeModal();
  }

  return (
    <div className="modal-backdrop" onClick={closeModal}>
      <div className="clone-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Clonar {DAYS[selectedDay]}</h2>
          <button className="modal-close" onClick={closeModal} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="clone-preview-label">
          {sourceLog.length} exercício{sourceLog.length === 1 ? '' : 's'} serão copiados
        </div>
        <div className="clone-preview-list">
          {sourceLog.length === 0 ? (
            <p style={{ color: 'var(--text-3)', fontSize: '0.78rem' }}>Este dia está vazio.</p>
          ) : (
            sourceLog.map((entry, i) => {
              const ex = exercises.find((e) => e.id === entry.exId);
              return (
                <div className="clone-ex-item" key={i}>
                  <span className="clone-ex-name">{ex?.name ?? entry.exId}</span>
                  <span className="clone-ex-detail">
                    {isCardioLogEntry(entry) ? `${entry.duration}min` : `${entry.sets}×${entry.reps}`}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="clone-target-label">Copiar para:</div>
        <div className="clone-day-grid">
          {DAYS_SHORT.map((short, i) => {
            const isSource = i === selectedDay;
            const cnt = totalDaySets(i, weekLog);
            return (
              <button
                key={short}
                className={`clone-day-opt${targetDay === i ? ' clone-day-opt-active' : ''}`}
                disabled={isSource}
                onClick={() => setTargetDay(i)}
              >
                <span className="clone-day-short">{short}</span>
                <span className="clone-day-cnt">{isSource ? 'origem' : `${cnt}s`}</span>
              </button>
            );
          })}
        </div>

        <button
          className="btn-block-primary"
          disabled={targetDay === null || sourceLog.length === 0}
          onClick={handleConfirm}
        >
          Clonar para {targetDay !== null ? DAYS[targetDay] : '...'}
        </button>
      </div>
    </div>
  );
}
