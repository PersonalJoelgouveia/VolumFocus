import { useState } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useExerciseStore } from '../../store/useExerciseStore';
import { useConfirmStore } from '../../store/useConfirmStore';
import { norm } from '../../utils/importParser';
import type { Exercise } from '../../types/exercise';
import type { StrengthLogEntry } from '../../types/workout';
import '../modals/AddExerciseModal.css';
import './EditExerciseModal.css';

interface EditExerciseModalProps {
  entry: StrengthLogEntry;
  exercise: Exercise;
  onUpdate: (patch: Partial<StrengthLogEntry>) => void;
  onRemoveExercise: () => void;
  onMarkDone: () => void;
  onUnmarkDone: () => void;
  onClose: () => void;
}

interface SerieDraft {
  reps: number;
  load: number;
  done: boolean;
}

/**
 * Editor de exercício (ícone ✏️ na lista do dia) — sucessor do antigo
 * botão 🗑️ "Remover", que virou uma ação PT-only *dentro* deste modal
 * em vez de estar solta na linha.
 *
 * Regras de permissão (pedido explícito):
 * - Séries: aluno só adiciona e marca como feita; remover é só do Personal.
 * - Repetições: Personal define a janela (min–max); aluno edita dentro dela.
 * - Carga: os dois editam livremente.
 * - Trocar o exercício: só o Personal (decisão estrutural da prescrição).
 *
 * Só se aplica a exercícios de força — cardio continua com o fluxo antigo
 * (duração/intensidade não têm "séries" nesse sentido).
 */
export function EditExerciseModal({ entry, exercise, onUpdate, onRemoveExercise, onMarkDone, onUnmarkDone, onClose }: EditExerciseModalProps) {
  const isPersonalMode = useUIStore((s) => s.isPersonalMode);
  const showToast = useUIStore((s) => s.showToast);
  const exercises = useExerciseStore((s) => s.exercises);

  const initialCount = entry.serieLoads.length || entry.sets || 1;
  const [series, setSeries] = useState<SerieDraft[]>(() =>
    Array.from({ length: initialCount }, (_, i) => ({
      reps: entry.serieReps[i] ?? entry.reps,
      load: entry.serieLoads[i] ?? entry.load,
      done: entry.doneSerie?.[i] ?? false,
    }))
  );
  const [repMin, setRepMin] = useState(entry.repRangeMin != null ? String(entry.repRangeMin) : '');
  const [repMax, setRepMax] = useState(entry.repRangeMax != null ? String(entry.repRangeMax) : '');
  const [swapQuery, setSwapQuery] = useState('');

  const min = repMin !== '' ? Number(repMin) : entry.repRangeMin;
  const max = repMax !== '' ? Number(repMax) : entry.repRangeMax;

  function clampReps(v: number): number {
    if (isPersonalMode) return Math.max(1, v);
    let r = v;
    if (min != null) r = Math.max(min, r);
    if (max != null) r = Math.min(max, r);
    return Math.max(1, r);
  }

  function updateSerie(idx: number, patch: Partial<SerieDraft>) {
    setSeries((s) => s.map((serie, i) => (i === idx ? { ...serie, ...patch } : serie)));
  }

  function addSerie() {
    setSeries((s) => {
      const last = s[s.length - 1];
      return [...s, { reps: last?.reps ?? entry.reps, load: last?.load ?? entry.load, done: false }];
    });
  }

  function removeSerie(idx: number) {
    setSeries((s) => (s.length <= 1 ? s : s.filter((_, i) => i !== idx)));
  }

  const swapMatches = swapQuery.trim()
    ? exercises.filter((e) => e.type !== 'cardio' && e.id !== entry.exId && norm(e.name).includes(norm(swapQuery))).slice(0, 8)
    : [];

  function handleSwap(newExId: string) {
    onUpdate({ exId: newExId });
    showToast('✅ Exercício trocado', 'success');
    onClose();
  }

  async function handleRemoveExercicio() {
    const ok = await useConfirmStore.getState().ask(`Remover "${exercise.name}" do dia?`, { confirmLabel: 'Remover', danger: true });
    if (!ok) return;
    onRemoveExercise();
    onClose();
  }

  function handleSalvar() {
    if (series.length === 0) return showToast('⚠️ Adicione ao menos uma série.', 'warning');

    const serieReps = series.map((s) => s.reps);
    const serieLoads = series.map((s) => s.load);
    const doneSerie = series.map((s) => s.done);

    const patch: Partial<StrengthLogEntry> = {
      sets: series.length,
      reps: serieReps[0],
      load: serieLoads[0],
      serieReps,
      serieLoads,
      doneSerie,
    };
    if (isPersonalMode) {
      patch.repRangeMin = repMin === '' ? undefined : Number(repMin);
      patch.repRangeMax = repMax === '' ? undefined : Number(repMax);
    }
    onUpdate(patch);

    const allDone = doneSerie.length > 0 && doneSerie.every(Boolean);
    if (allDone) onMarkDone();
    else onUnmarkDone();

    showToast('✅ Exercício atualizado', 'success');
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="cli-detail-panel editex-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✏️ {exercise.name}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        {isPersonalMode && (
          <div className="form-group">
            <label>Trocar Exercício</label>
            <div className="addex-combo">
              <input
                className="addex-search"
                placeholder="Buscar outro exercício…"
                value={swapQuery}
                onChange={(e) => setSwapQuery(e.target.value)}
              />
              {swapQuery.trim() && (
                <div className="addex-dropdown">
                  {swapMatches.length === 0 ? (
                    <div className="addex-dropdown-item" style={{ cursor: 'default' }}>
                      Nenhum exercício encontrado
                    </div>
                  ) : (
                    swapMatches.map((ex) => (
                      <button key={ex.id} className="addex-dropdown-item" onClick={() => handleSwap(ex.id)}>
                        <span>{ex.name}</span>
                        <span className="addex-dropdown-tag">{ex.agonist}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {isPersonalMode && (
          <div className="form-group">
            <label>Janela de Repetições (opcional)</label>
            <div className="editex-reprange-row">
              <input type="number" inputMode="numeric" min={1} placeholder="mín" value={repMin} onChange={(e) => setRepMin(e.target.value)} />
              <span>até</span>
              <input type="number" inputMode="numeric" min={1} placeholder="máx" value={repMax} onChange={(e) => setRepMax(e.target.value)} />
            </div>
            <div className="editex-reprange-hint">
              {min != null && max != null
                ? `O aluno só poderá ajustar as repetições entre ${min} e ${max}.`
                : 'Deixe em branco pra o aluno editar as repetições livremente.'}
            </div>
          </div>
        )}

        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Séries</label>
        <div className="editex-serie-list">
          {series.map((s, i) => (
            <div className={`editex-serie-row${s.done ? ' is-done' : ''}`} key={i}>
              <span className="editex-serie-num">#{i + 1}</span>
              <button
                type="button"
                className={`editex-serie-check${s.done ? ' checked' : ''}`}
                onClick={() => updateSerie(i, { done: !s.done })}
                title={s.done ? 'Marcar como não feita' : 'Marcar como feita'}
                aria-label="Marcar série como feita"
              >
                ✓
              </button>
              <div className="editex-serie-field">
                <input
                  type="number"
                  inputMode="numeric"
                  min={min ?? 1}
                  max={max ?? undefined}
                  value={s.reps}
                  onChange={(e) => updateSerie(i, { reps: clampReps(Number(e.target.value) || 1) })}
                  aria-label="Repetições"
                />
                <span>reps</span>
              </div>
              <div className="editex-serie-field">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.5}
                  value={s.load}
                  onChange={(e) => updateSerie(i, { load: Math.max(0, Number(e.target.value) || 0) })}
                  aria-label="Carga em kg"
                />
                <span>kg</span>
              </div>
              {isPersonalMode && (
                <button type="button" className="editex-serie-remove" onClick={() => removeSerie(i)} title="Remover série" aria-label="Remover série">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        <button className="btn btn-ghost editex-add-serie-btn" onClick={addSerie}>
          + Adicionar Série
        </button>

        <div className="editex-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSalvar}>
            💾 Salvar Alterações
          </button>
        </div>

        {isPersonalMode && (
          <button className="btn btn-danger editex-danger-btn" onClick={handleRemoveExercicio}>
            🗑️ Remover Exercício do Dia
          </button>
        )}
      </div>
    </div>
  );
}
