import { useState } from 'react';
import { useAlunoStore } from '../../store/useAlunoStore';
import { useUIStore } from '../../store/useUIStore';
import { DAYS_SHORT, GROUP_LABELS } from '../../types/workout';
import { isAlunoExercicioCardio } from '../../types/aluno';
import type { AlunoExercicio } from '../../types/aluno';
import { buildGroupedRows } from '../../utils/dayLogGrouping';
import { useReorderDrag } from '../../hooks/useReorderDrag';
import { syncRotinaToCloud } from '../../lib/alunoRepository';
import { ExercicioFormModal } from './ExercicioFormModal';
import { ImportRotinaModal } from './ImportRotinaModal';
import './ClientesView.css';

interface RoutineEditorModalProps {
  alunoId: string;
  initialDay: number;
  onClose: () => void;
}

/**
 * Sucessor do módulo cliEd_ (editor "Criar Treino", index.html
 * ~10718-10965 + cli_ed_salvarEPublicar ~11175-11182): barra de dias,
 * lista de exercícios do dia com adicionar/editar/remover/reordenar
 * (useReorderDrag, mesmo hook do Registro) e "Salvar & Publicar", que
 * grava a rotina no Firestore vinculada ao e-mail do aluno.
 */
export function RoutineEditorModal({ alunoId, initialDay, onClose }: RoutineEditorModalProps) {
  const aluno = useAlunoStore((s) => s.getAluno(alunoId));
  const addExercicio = useAlunoStore((s) => s.addExercicio);
  const updateExercicio = useAlunoStore((s) => s.updateExercicio);
  const removeExercicio = useAlunoStore((s) => s.removeExercicio);
  const reorderExercicios = useAlunoStore((s) => s.reorderExercicios);
  const marcarDescanso = useAlunoStore((s) => s.marcarDescanso);
  const marcarPublicadoHoje = useAlunoStore((s) => s.marcarPublicadoHoje);
  const showToast = useUIStore((s) => s.showToast);

  const [day, setDay] = useState(initialDay);
  const [reorderMode, setReorderMode] = useState(false);
  const [exercicioIdx, setExercicioIdx] = useState<number | null | 'new'>(null);
  const [publishing, setPublishing] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  function handleReorder(fromIdx: number, toIdx: number) {
    reorderExercicios(alunoId, day, fromIdx, toIdx);
  }
  const { getItemProps, isDragging, isDragOver } = useReorderDrag(reorderMode, handleReorder);

  if (!aluno) return null;
  const dia = aluno.rotina[day];

  function handleSaveExercicio(ex: AlunoExercicio) {
    if (exercicioIdx === 'new') {
      addExercicio(alunoId, day, ex);
      showToast('✅ Exercício adicionado', 'success');
    } else if (typeof exercicioIdx === 'number') {
      updateExercicio(alunoId, day, exercicioIdx, ex);
      showToast('✅ Exercício atualizado', 'success');
    }
    setExercicioIdx(null);
  }

  function handleRemoveExercicio() {
    if (typeof exercicioIdx !== 'number') return;
    removeExercicio(alunoId, day, exercicioIdx);
    showToast('🗑️ Exercício removido', 'success');
    setExercicioIdx(null);
  }

  async function handlePublicar() {
    setPublishing(true);
    const ok = await syncRotinaToCloud(aluno!.email, aluno!.rotina);
    setPublishing(false);
    if (!ok) {
      showToast('⚠️ Não foi possível publicar — confira a conexão e o e-mail do aluno', 'warning');
      return;
    }
    marcarPublicadoHoje(alunoId);
    showToast(`☁️ Rotina de ${aluno!.nome.split(' ')[0]} publicada com sucesso!`, 'success');
    onClose();
  }

  function renderExItem(ex: AlunoExercicio, i: number) {
    return (
      <div
        className={`cli-ed-ex-item${isDragging(i) ? ' ro-dragging' : ''}${isDragOver(i) ? ' ro-drag-over' : ''}`}
        key={i}
        onClick={() => !reorderMode && setExercicioIdx(i)}
        {...getItemProps(i)}
      >
        {reorderMode && (
          <span className="cli-ed-ro-handle" title="Arrastar para reordenar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="6" r="1.1" fill="currentColor" stroke="none" />
              <circle cx="9" cy="12" r="1.1" fill="currentColor" stroke="none" />
              <circle cx="9" cy="18" r="1.1" fill="currentColor" stroke="none" />
              <circle cx="15" cy="6" r="1.1" fill="currentColor" stroke="none" />
              <circle cx="15" cy="12" r="1.1" fill="currentColor" stroke="none" />
              <circle cx="15" cy="18" r="1.1" fill="currentColor" stroke="none" />
            </svg>
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cli-ex-name">{ex.nome}</div>
          <div className="cli-ex-detail">
            {isAlunoExercicioCardio(ex) ? (
              <>
                <span className="cli-ex-chip">{ex.duracao || '-'}</span>
                <span className="cli-ex-chip">{ex.intensidade || '-'}</span>
              </>
            ) : (
              <>
                <span className="cli-ex-chip">
                  {ex.series}×{ex.reps}
                </span>
                <span className="cli-ex-chip">{ex.carga}kg</span>
                {ex.rir != null && <span className="cli-ex-chip">RIR {ex.rir}</span>}
                {ex.sugestao && <span className="cli-ex-chip cli-ex-chip-sug">▲ {ex.sugestao}kg</span>}
              </>
            )}
          </div>
          {ex.notes && (
            <div style={{ fontSize: '0.65rem', color: 'var(--teal)', marginTop: 4, fontStyle: 'italic' }}>
              # {ex.notes}
            </div>
          )}
        </div>
        {!reorderMode && <span className="cli-ed-ex-handle">✎</span>}
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="cli-editor-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Treinos: {aluno.nome}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="cli-days-bar">
          {DAYS_SHORT.map((label, d) => {
            const count = aluno.rotina[d].exercicios.length;
            return (
              <button
                key={label}
                className={`cli-day-btn${day === d ? ' active' : ''}`}
                onClick={() => {
                  setReorderMode(false);
                  setDay(d);
                }}
              >
                <div className="cli-dl">{label}</div>
                <div className="cli-ds">{count > 0 ? `${count}ex` : '-'}</div>
              </button>
            );
          })}
        </div>

        <div className="sec-row" style={{ marginBottom: 10 }}>
          <div className="cli-day-type" style={{ margin: 0 }}>
            {dia.tipo}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {dia.exercicios.length > 1 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setReorderMode((v) => !v)}>
                {reorderMode ? '✓ Concluir' : '↕️ Reordenar'}
              </button>
            )}
            {dia.exercicios.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => marcarDescanso(alunoId, day)}>
                💤 Marcar Descanso
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={() => setExercicioIdx('new')}>
              + Exercício
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setImportOpen(true)}>
              📥 Importar Treino
            </button>
          </div>
        </div>

        <div className="cli-ed-day-content">
          {dia.exercicios.length === 0 ? (
            <div className="cli-rest-day">
              💤 Nenhum exercício neste dia ainda.
              <br />
              Toque em "+ Exercício" para começar a montar o treino.
            </div>
          ) : reorderMode ? (
            dia.exercicios.map((ex, i) => renderExItem(ex, i))
          ) : (
            buildGroupedRows(dia.exercicios).map((row) =>
              row.kind === 'free' ? (
                renderExItem(row.entry, row.index)
              ) : (
                <div className="cj-group" key={row.groupId}>
                  <div className="cj-group-header">
                    <span className="cj-group-badge">{GROUP_LABELS[row.members[0].entry.groupType ?? 'biset']}</span>
                    <span className="cj-group-desc">{row.members.length} exercícios conjugados</span>
                  </div>
                  {row.members.map((m, k) => (
                    <div key={m.index}>
                      {k > 0 && <div className="cj-connector" />}
                      {renderExItem(m.entry, m.index)}
                    </div>
                  ))}
                </div>
              )
            )
          )}
        </div>

        <button className="btn-block-primary" style={{ marginTop: 16 }} disabled={publishing} onClick={handlePublicar}>
          {publishing ? 'Publicando…' : `☁️ Salvar & Publicar para ${aluno.nome.split(' ')[0]}`}
        </button>
      </div>

      {exercicioIdx !== null && (
        <ExercicioFormModal
          existing={exercicioIdx === 'new' ? undefined : dia.exercicios[exercicioIdx]}
          onSave={handleSaveExercicio}
          onRemove={exercicioIdx !== 'new' ? handleRemoveExercicio : undefined}
          onClose={() => setExercicioIdx(null)}
        />
      )}

      {importOpen && <ImportRotinaModal alunoId={alunoId} day={day} onClose={() => setImportOpen(false)} />}
    </div>
  );
}
