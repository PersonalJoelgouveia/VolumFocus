import { useEffect, useState } from 'react';
import { useExecStore } from '../../store/useExecStore';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { useExerciseStore } from '../../store/useExerciseStore';
import { useUIStore } from '../../store/useUIStore';
import { useAuthStore } from '../../store/useAuthStore';
import { registrarTreinoConcluido } from '../../lib/notificacaoRepository';
import { isCardioLogEntry } from '../../types/workout';
import type { StrengthLogEntry } from '../../types/workout';
import { MUSCLE_COLOR } from '../../data/muscleColors';
import './ExecutionModal.css';

const RING_R = 88;
const RING_C = 2 * Math.PI * RING_R;

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Modal de execução de um exercício — sucessor de #modal-execution +
 * execState (index.html ~3817-3880, ~6560-7064). Aberto por
 * ExerciseListItem via useExecStore.open(); os dados do exercício (entry,
 * séries) são lidos ao vivo de useWorkoutStore/useExerciseStore usando
 * exec.day/exec.idx — não há cópia local do log.
 */
export function ExecutionModal() {
  const exec = useExecStore();
  const showToast = useUIStore((s) => s.showToast);

  const weekLog = useWorkoutStore((s) => s.weekLog);
  const updateLogEntry = useWorkoutStore((s) => s.updateLogEntry);
  const markExerciseDone = useWorkoutStore((s) => s.markExerciseDone);
  const getDayLog = useWorkoutStore((s) => s.getDayLog);
  const isExerciseDone = useWorkoutStore((s) => s.isExerciseDone);
  const exercises = useExerciseStore((s) => s.exercises);
  const isPersonalMode = useUIStore((s) => s.isPersonalMode);
  const authUser = useAuthStore((s) => s.user);

  const [editReps, setEditReps] = useState('');
  const [editLoad, setEditLoad] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);

  const entry = exec.day !== null && exec.idx !== null ? weekLog[exec.day]?.[exec.idx] : undefined;
  const exercise = entry ? exercises.find((e) => e.id === entry.exId) : undefined;

  // Carrega a nota já salva sempre que o modal abre um novo exercício.
  useEffect(() => {
    if (exec.isOpen) setNotesDraft(entry?.notes ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exec.isOpen, exec.day, exec.idx]);

  // Tick do timer de descanso — um único setInterval, montado só enquanto o
  // modal está aberto e o timer rodando/tocando o alarme (mesmo padrão do
  // <TimerEngine> global, mas escopado à vida do modal).
  useEffect(() => {
    if (!exec.isOpen || !exec.running) return;
    const id = setInterval(() => {
      const { justFinished } = useExecStore.getState().tick();
      if (justFinished) {
        if (navigator.vibrate) {
          try {
            navigator.vibrate([200, 100, 200]);
          } catch {
            /* vibração indisponível */
          }
        }
        showToast('⏰ Descanso finalizado — bora pra próxima série!');
      }
    }, 1000);
    return () => clearInterval(id);
  }, [exec.isOpen, exec.running, showToast]);

  // Debounce do salvamento de notas (600ms), como no monolito.
  useEffect(() => {
    if (!exec.isOpen || exec.day === null || exec.idx === null) return;
    const id = setTimeout(() => {
      const val = notesDraft.trim();
      updateLogEntry(exec.day as number, exec.idx as number, { notes: val || undefined });
      setNotesSaved(true);
      const hideId = setTimeout(() => setNotesSaved(false), 1400);
      return () => clearTimeout(hideId);
    }, 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesDraft]);

  if (!exec.isOpen || !entry || !exercise) return null;

  const color = MUSCLE_COLOR[exercise.agonist] ?? '#888';
  const isCardio = isCardioLogEntry(entry);
  const strengthEntry: StrengthLogEntry | null = isCardio ? null : (entry as StrengthLogEntry);
  const progress = exec.restDuration > 0 ? Math.max(0, exec.remaining / exec.restDuration) : 0;

  function handleClose() {
    checkDiaConcluido();
    exec.close();
  }

  /**
   * Sucessor de `_ntfCheckDiaConcluido()` (index.html ~7066-7082): se
   * todos os exercícios do dia já estiverem marcados como feitos, registra
   * a notificação de "treino concluído" pro Personal ver. Só roda do lado
   * do aluno — no modo Personal, abrir/fechar o modal é só edição/preview
   * da rotina publicada, não uma sessão real de treino.
   */
  function checkDiaConcluido() {
    if (isPersonalMode || exec.day === null) return;
    const log = getDayLog(exec.day);
    if (!log.length) return;
    const todasFeitas = log.every((_, idx) => isExerciseDone(exec.day as number, idx));
    if (!todasFeitas || !authUser?.email) return;
    registrarTreinoConcluido(authUser.email, authUser.name, exec.day).catch((e) =>
      console.error('ExecutionModal: falha ao registrar treino concluído', e)
    );
  }

  function handleToggleSet(k: number) {
    if (exec.day === null || exec.idx === null || !entry || !exercise) return;
    const { justCompleted, allDone } = exec.toggleSet(k);
    if (!justCompleted) return;
    if (!allDone) {
      exec.startTimer();
      showToast(`💪 Série ${k + 1} concluída — descanso iniciado`);
    } else {
      exec.stopTimer();
      exec.stopAlarm();
      markExerciseDone(exec.day, exec.idx);
      showToast(`🏆 ${exercise.name} — todas as séries concluídas!`);
    }
  }

  function handleNextSet() {
    const k = exec.nextSet();
    if (k !== null) handleToggleSet(k);
  }

  function startEdit(k: number) {
    if (!strengthEntry) return;
    const load = strengthEntry.serieLoads?.[k] ?? strengthEntry.load;
    const reps = strengthEntry.serieReps?.[k] ?? strengthEntry.reps;
    setEditReps(String(reps));
    setEditLoad(String(load));
    exec.editSet(k);
  }

  function saveEdit(k: number) {
    if (exec.day === null || exec.idx === null || !strengthEntry) return;
    const newReps = Math.max(1, parseInt(editReps, 10) || 1);
    const newLoad = Math.max(0, parseFloat(editLoad) || 0);

    const serieLoads = strengthEntry.serieLoads?.length
      ? [...strengthEntry.serieLoads]
      : Array(exec.totalSets).fill(strengthEntry.load || 0);
    const serieReps = strengthEntry.serieReps?.length
      ? [...strengthEntry.serieReps]
      : Array(exec.totalSets).fill(strengthEntry.reps || 10);
    serieLoads[k] = newLoad;
    serieReps[k] = newReps;

    const patch: Partial<StrengthLogEntry> = { serieLoads, serieReps };
    if (k === 0) {
      patch.load = newLoad;
      patch.reps = newReps;
    }
    updateLogEntry(exec.day, exec.idx, patch);
    exec.finishEditSet();
  }

  const allSetsDone = !isCardio && exec.totalSets > 0 && exec.current >= exec.totalSets;
  const ringLabel = exec.alarming
    ? '🔔 Toque para parar'
    : exec.running
      ? isCardio
        ? 'Em andamento…'
        : 'Descansando…'
      : allSetsDone
        ? 'Exercício concluído 🎉'
        : exec.remaining > 0 && exec.remaining < exec.restDuration
          ? 'Pausado'
          : isCardio
            ? 'Cronômetro'
            : 'Pronto para iniciar';

  const ringWarn = exec.running && exec.remaining > 0 && exec.remaining <= 10;
  const ringDone = exec.remaining <= 0;

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="exec-modal-panel" onClick={(e) => e.stopPropagation()}>
        <button className="exec-dismiss" onClick={handleClose} aria-label="Fechar" title="Fechar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="4" y1="4" x2="20" y2="20" />
            <line x1="20" y1="4" x2="4" y2="20" />
          </svg>
        </button>

        <div className="exec-header">
          <div className="exec-accent" style={{ background: color }} />
          <div className="exec-ex-name">{exercise.name}</div>
          <div className="exec-ex-tags">
            {isCardio ? (
              <span className="ex-tag ex-tag-cardio">❤️ Cardio</span>
            ) : (
              <>
                <span className="ex-tag ex-tag-ag">{exercise.agonist}</span>
                {exercise.synergist.map((m) => (
                  <span className="ex-tag ex-tag-sin" key={m}>
                    {m}
                  </span>
                ))}
              </>
            )}
          </div>
        </div>

        {!isCardio && (
          <div>
            <div className="exec-sets-label">Progresso das séries</div>
            <div className="exec-sets-list">
              {Array.from({ length: exec.totalSets }).map((_, k) => {
                const load = strengthEntry!.serieLoads?.[k] ?? strengthEntry!.load;
                const reps = strengthEntry!.serieReps?.[k] ?? strengthEntry!.reps;
                const isDone = exec.done[k];
                const isActive = !isDone && k === exec.current;
                const isEditing = exec.editingSet === k;

                return (
                  <div
                    className={`exec-set-pill${isDone ? ' is-done' : ''}${isActive ? ' is-active' : ''}`}
                    key={k}
                    role="button"
                    tabIndex={0}
                    onClick={() => !isEditing && handleToggleSet(k)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !isEditing) {
                        e.preventDefault();
                        handleToggleSet(k);
                      }
                    }}
                  >
                    <span className="exec-set-num">SÉR {k + 1}</span>
                    <span className="exec-set-body">
                      {isEditing ? (
                        <span className="exec-set-edit" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={200}
                            value={editReps}
                            aria-label="Repetições"
                            autoFocus
                            onChange={(e) => setEditReps(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit(k);
                              else if (e.key === 'Escape') exec.cancelEditSet();
                            }}
                          />
                          <span>×</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={0.5}
                            value={editLoad}
                            aria-label="Carga em kg"
                            onChange={(e) => setEditLoad(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit(k);
                              else if (e.key === 'Escape') exec.cancelEditSet();
                            }}
                          />
                          <span>kg</span>
                          <span
                            className="exec-set-save-btn"
                            role="button"
                            tabIndex={0}
                            aria-label="Salvar série"
                            title="Salvar"
                            onClick={(e) => {
                              e.stopPropagation();
                              saveEdit(k);
                            }}
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="4 12 9 17 20 6" />
                            </svg>
                          </span>
                        </span>
                      ) : (
                        <span
                          className="exec-set-info"
                          role="button"
                          tabIndex={0}
                          aria-label="Editar carga e repetições"
                          title="Toque para editar"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(k);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.stopPropagation();
                              startEdit(k);
                            }
                          }}
                        >
                          {reps}× {load}kg
                        </span>
                      )}
                    </span>
                    <span className="exec-set-check">{isDone ? '✓' : ''}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="exec-notes-wrap">
          <label className="exec-notes-label" htmlFor="exec-notes-input">
            <span className="exec-notes-hash">#</span> Notas pessoais <span className="exec-notes-opt">(opcional)</span>
            <span className={`exec-notes-saved${notesSaved ? ' is-visible' : ''}`}>✓ salvo</span>
          </label>
          <textarea
            className="exec-notes-input"
            id="exec-notes-input"
            rows={2}
            maxLength={240}
            placeholder="Ex: senti desconforto no ombro, ritmo mais lento hoje…"
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
          />
        </div>

        <div className="exec-timer-wrap">
          <div
            className={`exec-ring${ringWarn ? ' exec-ring-warn' : ''}${ringDone ? ' exec-ring-done' : ''}${exec.alarming ? ' exec-ring-alarm' : ''}`}
            role="button"
            tabIndex={0}
            aria-label="Toque para iniciar ou pausar o descanso."
            title="Toque: iniciar/pausar"
            onClick={() => exec.ringSingleTap()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                exec.ringSingleTap();
              }
            }}
          >
            <svg className="exec-ring-svg" viewBox="0 0 200 200">
              <circle className="exec-ring-bg" cx="100" cy="100" r={RING_R} />
              <circle
                className="exec-ring-prog"
                cx="100"
                cy="100"
                r={RING_R}
                style={{ strokeDasharray: `${RING_C} ${RING_C}`, strokeDashoffset: `${RING_C * (1 - progress)}` }}
              />
            </svg>
            <div className="exec-ring-center">
              <div className="exec-ring-time">{fmt(exec.remaining)}</div>
              <div className={`exec-ring-label${exec.alarming ? ' exec-ring-label-sm' : ''}`}>{ringLabel}</div>
            </div>
          </div>

          <div className="exec-controls">
            <button className="btn btn-ghost btn-sm exec-ctrl-btn exec-reset-btn" onClick={() => exec.resetTimer()} aria-label="Resetar timer" title="Resetar timer">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </button>
            <button className="btn btn-ghost btn-sm exec-ctrl-btn" onClick={() => exec.adjustRest(-30)}>
              − 30s
            </button>
            <button className="btn btn-ghost btn-sm exec-ctrl-btn" onClick={() => exec.adjustRest(30)}>
              + 30s
            </button>
            {!isCardio && (
              <button
                className={`btn btn-primary exec-ctrl-btn exec-next-btn${exec.current >= exec.totalSets ? ' is-done' : ''}`}
                onClick={handleNextSet}
                disabled={exec.current >= exec.totalSets}
                aria-label="Próxima série"
                title="Próxima série"
              >
                <svg className="exec-skip-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                  <path d="M5 5l9 7-9 7V5z" />
                  <rect x="15.5" y="5" width="2.6" height="14" rx="1" />
                </svg>
                <svg className="exec-done-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="4 12 9 17 20 6" />
                </svg>
              </button>
            )}
          </div>

          <div className="exec-presets">
            {exec.presets.map((s) => (
              <button
                key={s}
                className={`exec-preset-pill${exec.restDuration === s ? ' is-active' : ''}`}
                onClick={() => exec.setPreset(s)}
              >
                {s}s
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
