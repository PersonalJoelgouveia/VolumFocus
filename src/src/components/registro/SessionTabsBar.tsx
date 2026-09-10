import { useState } from 'react';
import type { MouseEvent } from 'react';
import { useSessionStore, MAX_SESSOES } from '../../store/useSessionStore';
import { useAlunoStore } from '../../store/useAlunoStore';
import { useUIStore } from '../../store/useUIStore';
import { useConfirmStore } from '../../store/useConfirmStore';
import type { SessaoStatus } from '../../types/session';
import './SessionTabsBar.css';

const STATUS_DOT: Record<SessaoStatus, string> = {
  ativo: '🟢',
  pausado: '🟡',
  'nao-iniciado': '⚪',
  concluido: '✓',
};

/**
 * Barra de Sessões Simultâneas — feature nova (sem equivalente no
 * index (3).html): permite ao Personal acompanhar até MAX_SESSOES
 * alunos ao vivo, num só dispositivo, alternando entre eles em 1 clique
 * sem perder o progresso de nenhum. Reaproveita inteiramente o Registro
 * (Treino → Semana Atual) já existente — a troca de aba só faz
 * swap do conteúdo de useWorkoutStore (ver useSessionStore), então
 * DayExerciseList/ExerciseListItem/ExecutionModal continuam idênticos,
 * sem nenhuma lógica duplicada.
 */
export function SessionTabsBar() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const abrirNovaSessao = useSessionStore((s) => s.abrirNovaSessao);
  const fecharSessao = useSessionStore((s) => s.fecharSessao);
  const alternarSessao = useSessionStore((s) => s.alternarSessao);
  const getStatus = useSessionStore((s) => s.getStatus);

  const alunos = useAlunoStore((s) => s.alunos);
  const showToast = useUIStore((s) => s.showToast);

  const [pickerOpen, setPickerOpen] = useState(false);

  const atLimit = sessions.length >= MAX_SESSOES;

  function handleAbrirNova(alunoId: string, alunoNome: string) {
    const ok = abrirNovaSessao(alunoId, alunoNome);
    if (!ok) {
      showToast(`⚠️ Limite de ${MAX_SESSOES} sessões simultâneas atingido.`, 'warning');
      return;
    }
    setPickerOpen(false);
    showToast(`✅ Sessão de ${alunoNome.split(' ')[0]} iniciada`, 'success');
  }

  async function handleFechar(e: MouseEvent, id: string, nome: string) {
    e.stopPropagation();
    const ok = await useConfirmStore.getState().ask(`Encerrar a sessão de ${nome.split(' ')[0]}? O progresso desta aba será perdido.`, {
      confirmLabel: 'Encerrar Sessão',
      danger: true,
    });
    if (!ok) return;
    fecharSessao(id);
    showToast('Sessão encerrada.');
  }

  return (
    <>
      <div className="sess-bar">
        <button
          className="sess-new-btn"
          onClick={() => (atLimit ? showToast(`⚠️ Limite de ${MAX_SESSOES} sessões simultâneas atingido.`, 'warning') : setPickerOpen(true))}
          disabled={atLimit}
          title={atLimit ? `Limite de ${MAX_SESSOES} sessões atingido` : 'Iniciar sessão com um aluno'}
        >
          + Novo Treino
        </button>

        {sessions.length > 0 && (
          <button
            className={`sess-tab sess-tab-own${activeSessionId === null ? ' active' : ''}`}
            onClick={() => alternarSessao(null)}
          >
            🏠 Meu Treino
          </button>
        )}

        {sessions.map((sess) => {
          const status = getStatus(sess.id);
          return (
            <button
              key={sess.id}
              className={`sess-tab${activeSessionId === sess.id ? ' active' : ''}`}
              onClick={() => alternarSessao(sess.id)}
              title={`${sess.alunoNome} — ${status}`}
            >
              <span className="sess-tab-dot">{STATUS_DOT[status]}</span>
              <span className="sess-tab-name">{sess.alunoNome.split(' ')[0]}</span>
              <span className="sess-tab-close" onClick={(e) => handleFechar(e, sess.id, sess.alunoNome)} role="button" aria-label="Encerrar sessão">
                ✕
              </span>
            </button>
          );
        })}

        {sessions.length > 0 && <span className="sess-limit-hint">{sessions.length}/{MAX_SESSOES}</span>}
      </div>

      {pickerOpen && (
        <div className="modal-backdrop" onClick={() => setPickerOpen(false)}>
          <div className="cli-detail-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2>Iniciar Sessão com Aluno</h2>
              <button className="modal-close" onClick={() => setPickerOpen(false)} aria-label="Fechar">
                ×
              </button>
            </div>
            {alunos.length === 0 ? (
              <div className="sess-picker-empty">
                Nenhum aluno cadastrado ainda.
                <br />
                Cadastre em Clientes antes de iniciar uma sessão.
              </div>
            ) : (
              <div className="sess-picker-list">
                {alunos.map((a) => {
                  const jaAberta = sessions.some((s) => s.alunoId === a.id);
                  return (
                    <button
                      key={a.id}
                      className="sess-picker-item"
                      disabled={jaAberta}
                      onClick={() => handleAbrirNova(a.id, a.nome)}
                    >
                      {a.nome}
                      {jaAberta && ' — já tem sessão aberta'}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
