import { useMemo, useState } from 'react';
import { useExerciseStore } from '../../store/useExerciseStore';
import { MUSCLE_COLOR } from '../../data/muscleColors';
import { TRAINING_METHODS } from '../../data/trainingMethods';
import { sugerirSubstitutos } from '../../utils/sugerirSubstitutos';
import type { TrainingModelEntrada, TrainingModelEntradaCardio, TrainingModelEntradaForca } from '../../types/trainingModel';
import { isTrainingModelEntradaCardio } from '../../types/trainingModel';
import '../clientes/ClientesView.css';
import '../../views/tools/ModelosToolView.css';

interface ModeloExercicioFormModalProps {
  existing?: TrainingModelEntrada;
  onSave: (entrada: TrainingModelEntrada) => void;
  onRemove?: () => void;
  onClose: () => void;
}

function novoId(): string {
  return `me-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Editor de uma entrada (`TrainingModelEntrada`) dentro de um bloco de
 * sessão do Modelo — mesma lógica de "Substituir exercício" já usada na
 * rotina do Cliente (utils/sugerirSubstitutos.ts: mesmo agonista →
 * sinergistas em comum → estabilizadores em comum, exclusivamente a
 * taxonomia existente do Banco), agora casando por `exId` direto (sem
 * precisar resolver por nome, já que TrainingModelEntrada referencia o
 * exercício por id). Mexe só na instância do modelo que o chamador
 * indicar — não sabe nada de outros modelos nem de Cliente/Rotinas Salvas.
 */
export function ModeloExercicioFormModal({ existing, onSave, onRemove, onClose }: ModeloExercicioFormModalProps) {
  const exercises = useExerciseStore((s) => s.exercises);
  const isEdit = !!existing;

  const [exId, setExId] = useState(existing?.exId ?? '');
  const [query, setQuery] = useState('');
  const [ddOpen, setDdOpen] = useState(false);
  const [substituindo, setSubstituindo] = useState(!isEdit);
  const [isCardio, setIsCardio] = useState(existing ? isTrainingModelEntradaCardio(existing) : false);

  const [series, setSeries] = useState(existing && !isTrainingModelEntradaCardio(existing) ? String(existing.series) : '3');
  const [repsMin, setRepsMin] = useState(existing && !isTrainingModelEntradaCardio(existing) ? String(existing.repsMin) : '8');
  const [repsMax, setRepsMax] = useState(existing && !isTrainingModelEntradaCardio(existing) ? String(existing.repsMax) : '12');
  const [rir, setRir] = useState(existing && !isTrainingModelEntradaCardio(existing) && existing.rir != null ? String(existing.rir) : '');
  const [duracaoMinutos, setDuracaoMinutos] = useState(existing && isTrainingModelEntradaCardio(existing) ? String(existing.duracaoMinutos) : '20');
  const [intensidade, setIntensidade] = useState(existing && isTrainingModelEntradaCardio(existing) ? existing.intensidade : 'Moderada');
  const [descansoSegundos, setDescansoSegundos] = useState(existing?.descansoSegundos != null ? String(existing.descansoSegundos) : '60');
  const [metodo, setMetodo] = useState(existing?.metodo ?? 'series_tradicionais');
  const [notas, setNotas] = useState(existing?.notas ?? '');

  const exercicioAtual = useMemo(() => exercises.find((e) => e.id === exId), [exercises, exId]);
  const sugestoes = useMemo(() => (substituindo && exercicioAtual ? sugerirSubstitutos(exercicioAtual, exercises) : []), [substituindo, exercicioAtual, exercises]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !substituindo) return [];
    return exercises.filter((e) => e.name.toLowerCase().includes(q) || e.agonist.toLowerCase().includes(q)).slice(0, 12);
  }, [query, exercises, substituindo]);

  function handleSelect(id: string) {
    const ex = exercises.find((e) => e.id === id);
    if (!ex) return;
    setExId(id);
    setQuery(ex.name);
    setDdOpen(false);
    setSubstituindo(false);
    setIsCardio(ex.type === 'cardio');
  }

  const valid = !!exId;

  function handleSubmit() {
    if (!valid) return;
    const base = {
      id: existing?.id ?? novoId(),
      exId,
      descansoSegundos: descansoSegundos ? Number(descansoSegundos) : undefined,
      metodo,
      groupId: existing?.groupId,
      groupType: existing?.groupType,
      notas: notas.trim() || undefined,
    };
    if (isCardio) {
      const entrada: TrainingModelEntradaCardio = {
        ...base,
        tipo: 'cardio',
        duracaoMinutos: Number(duracaoMinutos) || 0,
        intensidade: intensidade.trim() || 'Moderada',
      };
      onSave(entrada);
    } else {
      const entrada: TrainingModelEntradaForca = {
        ...base,
        series: Number(series) || 1,
        repsMin: Number(repsMin) || 1,
        repsMax: Number(repsMax) || Number(repsMin) || 1,
        rir: rir ? Number(rir) : undefined,
      };
      onSave(entrada);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel cli-ex-form-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Editar Exercício' : 'Adicionar Exercício'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        {isEdit && !substituindo && (
          <div className="cli-ex-current-row">
            <span className="cli-ex-current-nome">{exercicioAtual?.name ?? exId}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSubstituindo(true)}>
              🔄 Substituir
            </button>
          </div>
        )}

        {substituindo && isEdit && (
          <div className="cli-ex-sub-header">
            <span>Escolha o novo exercício</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSubstituindo(false)}>
              ← Cancelar
            </button>
          </div>
        )}

        {substituindo && sugestoes.length > 0 && (
          <div className="cli-sub-list">
            {sugestoes.map((s) => (
              <div className="combo-item" key={s.exercise.id} onClick={() => handleSelect(s.exercise.id)}>
                <div className="combo-dot" style={{ background: MUSCLE_COLOR[s.exercise.agonist] ?? '#888' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="combo-name">{s.exercise.name}</div>
                  <div className="combo-muscle">{s.motivo}</div>
                </div>
                <div className="combo-muscle">{s.exercise.agonist}</div>
              </div>
            ))}
          </div>
        )}

        {substituindo && (
          <div className="combo-wrap">
            <input
              className="combo-input"
              placeholder="Buscar exercício no banco…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setDdOpen(true);
              }}
              onFocus={() => query && setDdOpen(true)}
            />
            {ddOpen && (
              <div className="combo-dd open">
                {results.length === 0 ? (
                  <div style={{ padding: '12px 14px', fontSize: '0.78rem', color: 'var(--text-3)' }}>Nenhum exercício encontrado</div>
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

        {!substituindo && exId && (
          <>
            <div className="cli-ex-form-fields">
              {isCardio ? (
                <>
                  <label className="cli-form-field">
                    <span>Duração (min)</span>
                    <input type="number" min={1} value={duracaoMinutos} onChange={(e) => setDuracaoMinutos(e.target.value)} />
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
                    <span>Reps mín.</span>
                    <input type="number" min={1} value={repsMin} onChange={(e) => setRepsMin(e.target.value)} />
                  </label>
                  <label className="cli-form-field">
                    <span>Reps máx.</span>
                    <input type="number" min={1} value={repsMax} onChange={(e) => setRepsMax(e.target.value)} />
                  </label>
                  <label className="cli-form-field">
                    <span>RIR (opcional)</span>
                    <input type="number" min={0} max={10} value={rir} onChange={(e) => setRir(e.target.value)} />
                  </label>
                </>
              )}
              <label className="cli-form-field">
                <span>Descanso (seg)</span>
                <input type="number" min={0} value={descansoSegundos} onChange={(e) => setDescansoSegundos(e.target.value)} />
              </label>
              <label className="cli-form-field">
                <span>Método</span>
                <select value={metodo} onChange={(e) => setMetodo(e.target.value as typeof metodo)}>
                  {TRAINING_METHODS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cli-form-field full">
                <span>Notas (opcional)</span>
                <textarea rows={2} maxLength={240} value={notas} onChange={(e) => setNotas(e.target.value)} />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {isEdit && onRemove && (
                <button className="btn btn-danger" onClick={onRemove}>
                  🗑️ Remover
                </button>
              )}
              <button className="btn-block-primary" style={{ flex: 1 }} onClick={handleSubmit}>
                {isEdit ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
