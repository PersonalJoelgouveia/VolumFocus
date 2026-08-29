import { useState } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { useRotinaStore } from '../../store/useRotinaStore';
import { useConfirmStore } from '../../store/useConfirmStore';
import { DAYS_SHORT } from '../../types/workout';
import './RotinasModal.css';

const MODAL_ID = 'rotinas';

/**
 * Sucessor de #modal-rotinas + openRotinasModal/renderRotinasList/
 * rotinaSaveFromCurrent/_rotinaExec/rotinaExcluir (index.html
 * ~5763-5912): salvar a semana atual como template nomeado, listar,
 * aplicar (substituir ou mesclar) e excluir.
 *
 * A aba "Rotinas do Personal" do original (biblioteca compartilhada
 * PT→Aluno via `alunosrotinasModelo`, um SEGUNDO canal de
 * compartilhamento separado da publicação de rotina já existente em
 * RoutineEditorModal) não entrou aqui — abrir um segundo canal de
 * compartilhamento arriscava confundir o fluxo de Publicação já validado.
 * Fica como frente à parte se for necessária.
 */
export function RotinasModal() {
  const openModalId = useUIStore((s) => s.openModalId);
  const closeModal = useUIStore((s) => s.closeModal);
  const showToast = useUIStore((s) => s.showToast);
  const isOpen = openModalId === MODAL_ID;

  const weekLog = useWorkoutStore((s) => s.weekLog);
  const rotinas = useRotinaStore((s) => s.rotinas);
  const salvar = useRotinaStore((s) => s.salvar);
  const remover = useRotinaStore((s) => s.remover);
  const aplicar = useRotinaStore((s) => s.aplicar);

  const [nome, setNome] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);

  if (!isOpen) return null;

  function handleSalvar() {
    const trimmed = nome.trim();
    if (!trimmed) return showToast('⚠️ Digite um nome para a rotina', 'warning');
    salvar(trimmed, weekLog);
    setNome('');
    showToast('✅ Rotina salva!', 'success');
  }

  async function handleExcluir(id: number) {
    const ok = await useConfirmStore.getState().ask('Excluir esta rotina?', { confirmLabel: 'Excluir', danger: true });
    if (!ok) return;
    remover(id);
    showToast('🗑️ Rotina removida', 'success');
  }

  function handleAplicar(id: number, mode: 'replace' | 'merge') {
    const r = aplicar(id, mode);
    if (!r) return;
    setLoadingId(null);
    closeModal();
    showToast(`✅ Rotina "${r.nome}" carregada!`, 'success');
  }

  return (
    <div className="modal-backdrop" onClick={closeModal}>
      <div className="cli-detail-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2>📁 Rotinas Salvas</h2>
          <button className="modal-close" onClick={closeModal} aria-label="Fechar">
            ×
          </button>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginBottom: 16 }}>
          Salve estruturas de treino para reutilizar como ponto de partida da semana.
        </p>

        <div className="rotinas-create-block">
          <input
            type="text"
            placeholder="Nome da rotina (ex: Push/Pull/Legs)"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSalvar()}
          />
          <button className="btn btn-primary btn-sm" onClick={handleSalvar}>
            💾 Salvar Atual
          </button>
        </div>

        {rotinas.length === 0 ? (
          <div className="rotinas-empty">
            Nenhuma rotina salva ainda.
            <br />
            <span style={{ fontSize: '0.72rem' }}>Monte a semana no Registro e salve acima.</span>
          </div>
        ) : (
          <div className="routine-list">
            {rotinas.map((r) => {
              const diasAtivos = Object.entries(r.log).filter(([, exs]) => exs?.length > 0);
              const totalEx = diasAtivos.reduce((s, [, exs]) => s + exs.length, 0);
              const isChoosing = loadingId === r.id;
              return (
                <div className="routine-item" key={r.id}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="routine-name">{r.nome}</div>
                      <div className="routine-meta">
                        {diasAtivos.length} dia{diasAtivos.length === 1 ? '' : 's'} · {totalEx} ex. ·{' '}
                        {new Date(r.criada).toLocaleDateString('pt-BR')}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                        {diasAtivos.map(([d]) => (
                          <span className="routine-day-pill" key={d}>
                            {DAYS_SHORT[Number(d)]}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-icon btn-sm" title="Excluir" onClick={() => handleExcluir(r.id)}>
                      ✕
                    </button>
                  </div>

                  {isChoosing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => handleAplicar(r.id, 'replace')}>
                        🔄 Substituir semana inteira
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleAplicar(r.id, 'merge')}>
                        ➕ Adicionar por cima
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setLoadingId(null)}>
                        ← Voltar
                      </button>
                    </div>
                  ) : (
                    <button className="btn btn-primary btn-sm btn-full" onClick={() => setLoadingId(r.id)}>
                      Aplicar na Semana Atual →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
