import { useState } from 'react';
import { useExerciseStore } from '../../store/useExerciseStore';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { useUIStore } from '../../store/useUIStore';
import { MUSCLE_GROUPS } from '../../types/exercise';
import type { MuscleGroup } from '../../types/exercise';
import { MUSCLE_COLOR } from '../../data/muscleColors';
import { parseImportText } from '../../utils/importParser';
import type { ParsedImportItem } from '../../utils/importParser';
import './ImportWorkoutModal.css';

const MODAL_ID = 'import-workout';

/**
 * Modal de importação de treino por texto livre — sucessor do fluxo
 * parseImportText() → renderImportPreview() → confirmImport()
 * (index.html ~6260-6333).
 *
 * Nota de segurança (auditoria de cibersegurança / agosto 2026): o monolito
 * precisava do helper esc() porque montava HTML via innerHTML a partir de
 * dados do usuário (nome do exercício, notas). Aqui todo conteúdo dinâmico
 * (`{p.rawName}`, `{p.notes}` etc.) é renderizado como texto por JSX, que
 * escapa automaticamente — o mesmo vetor de XSS deixa de existir por
 * construção, sem precisar reimplementar esc().
 */
export function ImportWorkoutModal() {
  const openModalId = useUIStore((s) => s.openModalId);
  const closeModal = useUIStore((s) => s.closeModal);
  const showToast = useUIStore((s) => s.showToast);
  const isOpen = openModalId === MODAL_ID;

  const exercises = useExerciseStore((s) => s.exercises);
  const addExercise = useExerciseStore((s) => s.addExercise);
  const selectedDay = useWorkoutStore((s) => s.selectedDay);
  const getDayLog = useWorkoutStore((s) => s.getDayLog);
  const setDayLog = useWorkoutStore((s) => s.setDayLog);
  const setDayPSE = useWorkoutStore((s) => s.setDayPSE);

  const [rawText, setRawText] = useState('');
  const [items, setItems] = useState<ParsedImportItem[]>([]);
  const [pse, setPse] = useState<number | null>(null);
  const [hasParsed, setHasParsed] = useState(false);

  if (!isOpen) return null;

  function handleParse() {
    const result = parseImportText(rawText, exercises);
    setItems(result.items);
    setPse(result.pse);
    setHasParsed(true);
  }

  function handleMuscleChange(index: number, muscle: MuscleGroup) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, newMuscle: muscle } : it)));
  }

  function handleClose() {
    setRawText('');
    setItems([]);
    setPse(null);
    setHasParsed(false);
    closeModal();
  }

  function handleConfirm() {
    const log = [...getDayLog(selectedDay)];

    items.forEach((p) => {
      let exId = p.exId ?? p.matched?.id ?? null;
      if (!exId) {
        const newId = `imp${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
        addExercise({ id: newId, name: p.rawName, agonist: p.newMuscle, synergist: [], stabilizer: [] });
        exId = newId;
      }
      log.push({
        exId,
        sets: p.sets,
        reps: p.reps,
        load: p.load,
        serieLoads: [...p.serieLoads],
        serieReps: [...p.serieReps],
        ...(p.notes && { notes: p.notes }),
      });
    });

    setDayLog(selectedDay, log);
    if (pse !== null) setDayPSE(selectedDay, pse);
    showToast(`${items.length} exercícios importados.`, 'success');
    handleClose();
  }

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Importar Treino</h2>
          <button className="modal-close" onClick={handleClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <textarea
          id="import-text"
          className="import-textarea"
          placeholder={'Ex: Supino Reto 4x10 80kg #focar na descida\nAgachamento 3x8/8/6 100kg\nPSE: 7'}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={6}
        />

        <button className="btn-block-primary" onClick={handleParse}>
          Pré-visualizar
        </button>

        {hasParsed && (
          <div className="import-preview" id="import-preview">
            {items.length === 0 ? (
              <div className="import-empty">
                Formato não reconhecido. Use: Nome Sériesx Reps Cargakg
              </div>
            ) : (
              <div id="import-preview-list">
                {items.map((p, i) => {
                  const color = p.matched ? MUSCLE_COLOR[p.matched.agonist] ?? '#888' : 'var(--orange)';
                  return (
                    <div className="parse-item" key={i}>
                      <div className="parse-dot" style={{ background: color }} />
                      <div style={{ flex: 1 }}>
                        <div className="parse-name">{p.rawName}</div>
                        <div className="parse-detail">
                          {p.sets}×{p.serieReps.join('/')} ·{' '}
                          {p.serieLoads.some((l) => l > 0)
                            ? p.serieLoads.map((l) => `${l}kg`).join(' · ')
                            : 'sem carga'}
                        </div>
                        {p.notes && (
                          <div className="parse-note">
                            <span className="parse-hash">#</span> {p.notes}
                          </div>
                        )}
                        {p.matched ? (
                          <div className="parse-matched" style={{ color }}>
                            ✓ {p.matched.name} [{p.matched.agonist}]
                          </div>
                        ) : (
                          <div className="parse-unmatched">
                            ⚠️ Novo — agonista:{' '}
                            <select
                              value={p.newMuscle}
                              onChange={(e) => handleMuscleChange(i, e.target.value as MuscleGroup)}
                            >
                              {MUSCLE_GROUPS.map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {pse !== null && (
              <div className="pse-badge" id="import-pse-preview">
                <span>PSE</span>
                <span
                  className="pse-num"
                  style={{ color: pse <= 3 ? '#34d399' : pse <= 6 ? '#fbbf24' : pse <= 8 ? '#fb923c' : '#ff4d6d' }}
                >
                  {pse}
                </span>
                <span style={{ color: 'var(--text-3)', fontSize: '0.7rem' }}>/10</span>
              </div>
            )}

            {items.length > 0 && (
              <button className="btn-block-primary" id="btn-import-confirm" onClick={handleConfirm}>
                Confirmar Importação
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
