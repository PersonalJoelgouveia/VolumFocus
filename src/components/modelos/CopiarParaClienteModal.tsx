import { useState } from 'react';
import { useAlunoStore } from '../../store/useAlunoStore';
import { useModeloStore } from '../../store/useModeloStore';
import { useUIStore } from '../../store/useUIStore';
import { iniciais } from '../../types/aluno';
import type { ModeloTreino } from '../../types/modelo';
import type { CopiaModo } from '../../store/useModeloStore';
import '../clientes/ClientesView.css';
import '../../views/tools/ModelosToolView.css';

interface CopiarParaClienteModalProps {
  modelo: ModeloTreino;
  onClose: () => void;
}

/**
 * Fluxo "Modelo → Copiar para Cliente → Nova rotina independente": escolhe
 * um Cliente ativo e o modo de cópia, e delega em useModeloStore.
 * copiarParaCliente. A partir da confirmação, a rotina do Cliente é uma
 * cópia independente — editar depois nunca volta a alterar o Modelo.
 */
export function CopiarParaClienteModal({ modelo, onClose }: CopiarParaClienteModalProps) {
  const alunos = useAlunoStore((s) => s.alunos.filter((a) => a.status === 'ativo'));
  const copiarParaCliente = useModeloStore((s) => s.copiarParaCliente);
  const showToast = useUIStore((s) => s.showToast);

  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [modo, setModo] = useState<CopiaModo>('substituir');

  function handleConfirmar() {
    if (!alunoId) return;
    const ok = copiarParaCliente(modelo.id, alunoId, modo);
    const aluno = alunos.find((a) => a.id === alunoId);
    if (!ok) {
      showToast('⚠️ Não foi possível copiar o modelo para o Cliente', 'warning');
      return;
    }
    showToast(`✅ "${modelo.nome}" copiado para ${aluno?.nome.split(' ')[0] ?? 'o Cliente'}`, 'success');
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Copiar para Cliente</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <p className="md-copy-hint">
          Cria uma rotina nova e independente pro Cliente a partir de <strong>{modelo.nome}</strong>. Alterações
          futuras na rotina do Cliente não afetam este modelo.
        </p>

        {alunos.length === 0 ? (
          <div className="cli-rest-day">Nenhum Cliente ativo cadastrado ainda.</div>
        ) : (
          <div className="md-cliente-list">
            {alunos.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`md-cliente-item${alunoId === a.id ? ' active' : ''}`}
                onClick={() => setAlunoId(a.id)}
              >
                <span className="md-cliente-avatar">{iniciais(a.nome)}</span>
                <span className="md-cliente-nome">{a.nome}</span>
              </button>
            ))}
          </div>
        )}

        <div className="md-modo-field">
          <span className="md-modo-label">Modo de cópia</span>
          <div className="md-modo-options">
            <button
              type="button"
              className={`md-modo-btn${modo === 'substituir' ? ' active' : ''}`}
              onClick={() => setModo('substituir')}
            >
              Substituir a semana
              <small>Troca a rotina do Cliente inteira pela do modelo.</small>
            </button>
            <button
              type="button"
              className={`md-modo-btn${modo === 'mesclar' ? ' active' : ''}`}
              onClick={() => setModo('mesclar')}
            >
              Mesclar com a atual
              <small>Anexa os exercícios do modelo nos dias correspondentes.</small>
            </button>
          </div>
        </div>

        <button className="btn-block-primary" style={{ marginTop: 16 }} disabled={!alunoId} onClick={handleConfirmar}>
          Copiar para Cliente
        </button>
      </div>
    </div>
  );
}
