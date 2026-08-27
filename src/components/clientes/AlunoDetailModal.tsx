import { useState } from 'react';
import { useAlunoStore } from '../../store/useAlunoStore';
import { useUIStore } from '../../store/useUIStore';
import { DAYS, DAYS_SHORT } from '../../types/workout';
import { calcularIdade, iniciais, isAlunoExercicioCardio } from '../../types/aluno';
import './ClientesView.css';

interface AlunoDetailModalProps {
  alunoId: string;
  onClose: () => void;
  onEditPerfil: () => void;
  onEditarRotina: (day: number) => void;
}

/**
 * Sucessor de #modal-cli-aluno (cli_openAluno/cli_renderMiniPerfil/
 * cli_renderDaysBar/cli_renderDayContent, index.html ~10603-10716):
 * mini-perfil colapsável + barra de dias + lista de exercícios do dia
 * selecionado, somente leitura. "Editar Rotina" abre o RoutineEditorModal
 * no mesmo dia.
 */
export function AlunoDetailModal({ alunoId, onClose, onEditPerfil, onEditarRotina }: AlunoDetailModalProps) {
  const aluno = useAlunoStore((s) => s.getAluno(alunoId));
  const removeAluno = useAlunoStore((s) => s.removeAluno);
  const showToast = useUIStore((s) => s.showToast);

  const initialDay = aluno?.rotina.findIndex((d) => d.exercicios.length > 0) ?? -1;
  const [activeDay, setActiveDay] = useState(initialDay >= 0 ? initialDay : 0);
  const [perfilOpen, setPerfilOpen] = useState(false);

  if (!aluno) return null;

  const idade = calcularIdade(aluno.dataNascimento);
  const dia = aluno.rotina[activeDay];

  function handleExcluir() {
    if (!confirm(`Remover ${aluno!.nome} da lista de alunos?`)) return;
    removeAluno(aluno!.id);
    showToast('🗑️ Aluno removido', 'success');
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="cli-detail-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="cli-avatar">{iniciais(aluno.nome)}</div>
            <div>
              <h2 style={{ marginBottom: 2 }}>{aluno.nome}</h2>
              <div className="cli-detail-sub">
                {aluno.foco} · Último treino: {aluno.ultimoTreino ?? '—'}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <button className="cli-profile-toggle" onClick={() => setPerfilOpen((v) => !v)}>
          {perfilOpen ? '▲ Ocultar' : '▼ Ver'} mini-perfil
        </button>

        {perfilOpen && (
          <div className="cli-profile-grid">
            <div className="cli-profile-item full">
              <div className="cli-profile-label">E-mail</div>
              <div className="cli-profile-value">{aluno.email}</div>
            </div>
            <div className="cli-profile-item">
              <div className="cli-profile-label">Idade</div>
              <div className={`cli-profile-value${idade == null ? ' empty' : ''}`}>{idade != null ? `${idade} anos` : '—'}</div>
            </div>
            <div className="cli-profile-item">
              <div className="cli-profile-label">WhatsApp</div>
              <div className={`cli-profile-value${aluno.telefone ? '' : ' empty'}`}>{aluno.telefone || '—'}</div>
            </div>
            <div className="cli-profile-item">
              <div className="cli-profile-label">Gênero</div>
              <div className={`cli-profile-value${aluno.genero ? '' : ' empty'}`}>{aluno.genero || '—'}</div>
            </div>
            <div className="cli-profile-item">
              <div className="cli-profile-label">Objetivo</div>
              <div className={`cli-profile-value${aluno.objetivo ? '' : ' empty'}`}>{aluno.objetivo || '—'}</div>
            </div>
            <div className="cli-profile-item full">
              <div className="cli-profile-label">Lesões / Restrições</div>
              <div className={`cli-profile-value${aluno.restricoes ? '' : ' empty'}`}>{aluno.restricoes || '—'}</div>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={onEditPerfil}>
              ✏️ Editar dados cadastrais
            </button>
          </div>
        )}

        <div className="cli-days-bar">
          {DAYS_SHORT.map((label, d) => {
            const count = aluno.rotina[d].exercicios.length;
            return (
              <button
                key={label}
                className={`cli-day-btn${activeDay === d ? ' active' : ''}`}
                onClick={() => setActiveDay(d)}
              >
                <div className="cli-dl">{label}</div>
                <div className="cli-ds">{count > 0 ? `${count}ex` : '-'}</div>
              </button>
            );
          })}
        </div>

        <div className="cli-day-type">{dia.tipo}</div>

        <div className="cli-ex-list">
          {dia.exercicios.length === 0 ? (
            <div className="cli-rest-day">💤 Dia de descanso — nenhum exercício programado.</div>
          ) : (
            dia.exercicios.map((ex, i) => (
              <div className="cli-ex-item" key={i}>
                <div className="cli-ex-info">
                  <div className="cli-ex-name" title={ex.nome}>
                    {ex.nome}
                  </div>
                  <div className="cli-ex-detail">
                    {isAlunoExercicioCardio(ex) ? (
                      <>
                        <span className="cli-ex-chip">{ex.duracao}</span>
                        <span className="cli-ex-chip">Intensidade: {ex.intensidade}</span>
                      </>
                    ) : (
                      <>
                        <span className="cli-ex-chip">
                          {ex.series}×{ex.reps}
                        </span>
                        <span className="cli-ex-chip">{ex.carga}kg</span>
                        {ex.sugestao && <span className="cli-ex-chip cli-ex-chip-sug">▲ {ex.sugestao}kg</span>}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="cli-detail-actions">
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onEditarRotina(activeDay)}>
            ✎ Editar Rotina — {DAYS[activeDay]}
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleExcluir}>
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
