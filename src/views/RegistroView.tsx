import { useWorkoutStore } from '../store/useWorkoutStore';
import { useExerciseStore } from '../store/useExerciseStore';
import { useUIStore } from '../store/useUIStore';
import { useTimerStore } from '../store/useTimerStore';
import { useProgressStore } from '../store/useProgressStore';
import { DAYS } from '../types/workout';
import { isCardioLogEntry } from '../types/workout';
import type { StrengthLogEntry } from '../types/workout';

/**
 * View "Treinos" (Registro) — versão inicial das Fases 2-4, focada em
 * provar a navegação por dia, o fluxo de importação, o disparo do
 * cronômetro global (croAsk()) e a validação de sobrecarga progressiva
 * (prgCheck). A renderização detalhada de cada exercício do log (modal de
 * execução com anel de gestos, edição inline) fica para uma fase futura.
 */
export function RegistroView() {
  const selectedDay = useWorkoutStore((s) => s.selectedDay);
  const selectDay = useWorkoutStore((s) => s.selectDay);
  const weekLog = useWorkoutStore((s) => s.weekLog);
  const dayLog = weekLog[selectedDay] ?? [];
  const exercises = useExerciseStore((s) => s.exercises);
  const openModal = useUIStore((s) => s.openModal);
  const showToast = useUIStore((s) => s.showToast);

  const isTimerActive = useTimerStore((s) => s.isRunning || s.isPaused);
  const askToStart = useTimerStore((s) => s.askToStart);

  const checkEntries = useProgressStore((s) => s.checkEntries);

  /**
   * Substitui, por enquanto, o disparo automático de prgCheck.check() que no
   * monolito acontecia ao concluir cada exercício no modal de execução
   * (index.html ~9908) — modal esse ainda não migrado. Aqui a validação
   * roda sob demanda para todo o log do dia.
   */
  function handleCheckProgress() {
    const strengthEntries = dayLog.filter((e): e is StrengthLogEntry => !isCardioLogEntry(e));
    if (!strengthEntries.length) {
      showToast('Nenhum exercício de força para validar hoje.');
      return;
    }
    const before = useProgressStore.getState().popupMessages.length;
    checkEntries(strengthEntries, weekLog);
    const after = useProgressStore.getState().popupMessages.length;
    if (after === before) {
      showToast('Progressão dentro do esperado — nenhum alerta.', 'success');
    }
  }

  return (
    <div>
      <div className="sec-row">
        <div className="page-title">
          Treinos <span className="tag">SEMANA ATUAL</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!isTimerActive && (
            <button className="btn btn-primary" onClick={askToStart}>
              ⏱️ Cronometrar Treino
            </button>
          )}
          <button className="btn btn-primary" onClick={() => openModal('import-workout')}>
            📥 Importar Treino
          </button>
          <button className="btn btn-primary" onClick={handleCheckProgress}>
            📈 Verificar Progressão
          </button>
        </div>
      </div>

      <div className="level-pill">
        {DAYS.map((day, i) => (
          <button
            key={day}
            className={`lv-btn${selectedDay === i ? ' active' : ''}`}
            onClick={() => selectDay(i as 0 | 1 | 2 | 3 | 4 | 5 | 6)}
          >
            {day}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-title">
          Log de {DAYS[selectedDay]} · {dayLog.length} exercício{dayLog.length === 1 ? '' : 's'}
        </div>
        {dayLog.length === 0 ? (
          <p style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>
            Nenhum exercício registrado. Use "Importar Treino" para colar um texto livre.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {dayLog.map((entry, i) => {
              const ex = exercises.find((e) => e.id === entry.exId);
              return (
                <li key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
                  <strong>{ex?.name ?? entry.exId}</strong>
                  {' — '}
                  {isCardioLogEntry(entry)
                    ? `${entry.duration}min · intensidade ${entry.intensity}`
                    : `${entry.sets}×${entry.reps} · ${entry.load}kg`}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
