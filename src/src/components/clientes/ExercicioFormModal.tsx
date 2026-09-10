import { useMemo, useState } from 'react';
import { useExerciseStore } from '../../store/useExerciseStore';
import { getLastLoad } from '../../utils/lastLoad';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { MUSCLE_COLOR } from '../../data/muscleColors';
import type { AlunoExercicio } from '../../types/aluno';
import { isAlunoExercicioCardio } from '../../types/aluno';
import './ClientesView.css';

interface ExercicioFormModalProps {
  /** undefined = adicionar; AlunoExercicio = editar o existente na posição `idx`. */
  existing: AlunoExercicio | undefined;
  onSave: (ex: AlunoExercicio) => void;
  onRemove?: () => void;
  onClose: () => void;
}

/**
 * Sucessor de #modal-cli-ed-ex (cli_ed_abrirAddExercicio/cli_ed_abrirEditarExercicio/
 * cli_ed_handleComboInput/cli_ed_salvarExercicio, index.html ~10828-10952).
 * A busca (combo) só aparece ao adicionar um exercício novo — ao editar, o
 * nome já foi fixado e só os campos (séries/reps/carga/RIR ou cardio) mudam,
 * igual ao original.
 */
export function ExercicioFormModal({ existing, onSave, onRemove, onClose }: ExercicioFormModalProps) {
  const exercises = useExerciseStore((s) => s.exercises);
  const weekLog = useWorkoutStore((s) => s.weekLog);
  const isEdit = !!existing;

  const [query, setQuery] = useState(existing?.nome ?? '');
  const [ddOpen, setDdOpen] = useState(false);
  const [selectedExId, setSelectedExId] = useState<string | null>(null);
  const [isCardio, setIsCardio] = useState(existing ? isAlunoExercicioCardio(existing) : false);
  const [nomeFixo, setNomeFixo] = useState(existing?.nome ?? '');

  const [series, setSeries] = useState(existing && !isAlunoExercicioCardio(existing) ? String(existing.series) : '3');
  const [reps, setReps] = useState(existing && !isAlunoExercicioCardio(existing) ? existing.reps : '10-12');
  const [carga, setCarga] = useState(existing && !isAlunoExercicioCardio(existing) ? String(existing.carga) : '0');
  const [rir, setRir] = useState(existing && !isAlunoExercicioCardio(existing) && existing.rir != null ? String(existing.rir) : '');
  const [duracao, setDuracao] = useState(existing && isAlunoExercicioCardio(existing) ? existing.duracao : '');
  const [intensidade, setIntensidade] = useState(existing && isAlunoExercicioCardio(existing) ? existing.intensidade : '');
  const [notas, setNotas] = useState(existing?.notes ?? '');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || isEdit) return [];
    return exercises.filter((e) => e.name.toLowerCase().includes(q) || e.agonist.toLowerCase().includes(q)).slice(0, 12);
  }, [query, exercises, isEdit]);

  function handleSelect(id: string) {
    const ex = exercises.find((e) => e.id === id);
    if (!ex) return;
    setSelectedExId(id);
    setNomeFixo(ex.name);
    setQuery(ex.name);
    setDdOpen(false);
    const cardio = ex.type === 'cardio';
    setIsCardio(cardio);
    if (!cardio) {
      const last = getLastLoad(id, weekLog);
      if (last && last > 0) setCarga(String(Math.round(last * 1.025 * 2) / 2));
    }
  }

  const nome = isEdit ? nomeFixo : nomeFixo || query;
  const valid = isEdit ? true : !!selectedExId;

  function handleSubmit() {
    if (!valid) return;
    const notesVal = notas.trim();
    let ex: AlunoExercicio;
    if (isCardio) {
      ex = {
        nome,
        cardio: true,
        duracao: duracao.trim() || '20 min',
        intensidade: intensidade.trim() || 'Moderada',
        ...(notesVal && { notes: notesVal }),
      };
    } else {
      ex = {
        nome,
        series: parseInt(series, 10) || 1,
        reps: reps.trim() || '10',
        carga: parseFloat(carga) || 0,
        ...(rir !== '' && { rir: parseInt(rir, 10) }),
        ...(existing && !isAlunoExercicioCardio(existing) && existing.sugestao ? { sugestao: existing.sugestao } : {}),
        ...(notesVal && { notes: notesVal }),
      };
    }
    onSave(ex);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="cli-ex-form-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? '✎ Editar Exercício' : '➕ Adicionar Exercício'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        {!isEdit && (
          <div className="combo-wrap">
            <input
              className="combo-input"
              placeholder="Buscar exercício no banco…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedExId(null);
                setDdOpen(true);
              }}
              onFocus={() => query && setDdOpen(true)}
            />
            {ddOpen && (
              <div className="combo-dd open">
                {results.length === 0 ? (
                  <div style={{ padding: '12px 14px', fontSize: '0.78rem', color: 'var(--text-3)' }}>
                    Nenhum exercício encontrado
                  </div>
                ) : (
                  results.map((e) => (
                    <div className="combo-item" key={e.id} onClick={() => handleSelect(e.id)}>
                      <div className="combo-dot" style={{ background: MUSCLE_COLOR[e.agonist] ?? '#888' }} />
                      <div className="combo-name">{e.name}</div>
                      <div className="combo-muscle">{e.agonist}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {(isEdit || selectedExId) && (
          <div className="cli-ex-form-fields">
            {isCardio ? (
              <>
                <label className="cli-form-field">
                  <span>Duração</span>
                  <input value={duracao} onChange={(e) => setDuracao(e.target.value)} placeholder="Ex: 25 min" />
                </label>
                <label className="cli-form-field">
                  <span>Intensidade</span>
                  <input value={intensidade} onChange={(e) => setIntensidade(e.target.value)} placeholder="Ex: Moderada" />
                </label>
              </>
            ) : (
              <>
                <label className="cli-form-field">
                  <span>Séries</span>
                  <input type="number" min={1} value={series} onChange={(e) => setSeries(e.target.value)} />
                </label>
                <label className="cli-form-field">
                  <span>Repetições</span>
                  <input value={reps} onChange={(e) => setReps(e.target.value)} placeholder="Ex: 10-12" />
                </label>
                <label className="cli-form-field">
                  <span>Carga (kg)</span>
                  <input type="number" min={0} step={0.5} value={carga} onChange={(e) => setCarga(e.target.value)} />
                </label>
                <label className="cli-form-field">
                  <span>RIR (opcional)</span>
                  <input type="number" min={0} max={10} value={rir} onChange={(e) => setRir(e.target.value)} />
                </label>
              </>
            )}
            <label className="cli-form-field full">
              <span># Notas (opcional)</span>
              <textarea rows={2} maxLength={240} value={notas} onChange={(e) => setNotas(e.target.value)} />
            </label>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {isEdit && onRemove && (
            <button className="btn btn-danger" onClick={onRemove}>
              🗑️ Remover
            </button>
          )}
          <button className="btn-block-primary" style={{ flex: 1 }} disabled={!valid} onClick={handleSubmit}>
            {isEdit ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  );
}
