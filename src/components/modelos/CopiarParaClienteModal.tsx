import { useState } from 'react';
import { useAlunoStore } from '../../store/useAlunoStore';
import { useModeloStore } from '../../store/useModeloStore';
import { useUIStore } from '../../store/useUIStore';
import { iniciais } from '../../types/aluno';
import type { TrainingModel } from '../../types/trainingModel';
import '../clientes/ClientesView.css';
import '../../views/tools/ModelosToolView.css';

interface CopiarParaClienteModalProps {
  modelo: TrainingModel;
  onClose: () => void;
}

/**
 * Fluxo "Modelo → selecionar Cliente → confirmar → criar nova rotina":
 * grava a conversão do modelo (utils/buildAlunoRotinaFromTrainingModel.ts)
 * na rotina do Cliente escolhido via useModeloStore.copiarParaCliente — a
 * mesma estrutura de Clientes/Rotinas já existente, sem tocar em Rotinas
 * Salvas. O modelo nunca é alterado por essa ação; a rotina criada é uma
 * cópia independente — editá-la depois nunca volta a afetar o modelo.
 */
export function CopiarParaClienteModal({ modelo, onClose }: CopiarParaClienteModalProps) {
  const alunosTodos = useAlunoStore((s) => s.alunos);
const alunos = useMemo(
  () => alunosTodos.filter((a) => a.status === 'ativo'),
  [alunosTodos]
);
  const copiarParaCliente = useModeloStore((s) => s.copiarParaCliente);
  const showToast = useUIStore((s) => s.showToast);

  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const alunoSelecionado = alunos.find((a) => a.id === alunoId);

  function handleConfirmar() {
    if (!alunoId) return;
    const resultado = copiarParaCliente(modelo.id, alunoId);
    if (!resultado.ok) {
      showToast('⚠️ Não foi possível copiar o modelo para o Cliente', 'warning');
      return;
    }
    const nomeCliente = alunoSelecionado?.nome.split(' ')[0] ?? 'o Cliente';
    if (resultado.exerciciosNaoEncontrados.length > 0) {
      showToast(`⚠️ Rotina criada pra ${nomeCliente}, mas ${resultado.exerciciosNaoEncontrados.length} exercício(s) não foram encontrados no banco`, 'warning');
    } else {
      showToast(`✅ Nova rotina criada pra ${nomeCliente} a partir de "${modelo.nome}"`, 'success');
    }
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

        {!confirmando ? (
          <>
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

            <button className="btn-block-primary" style={{ marginTop: 16 }} disabled={!alunoId} onClick={() => setConfirmando(true)}>
              Continuar
            </button>
          </>
        ) : (
          <>
            <p className="md-copy-hint">
              Confirma criar uma nova rotina pra <strong>{alunoSelecionado?.nome}</strong> a partir de{' '}
              <strong>{modelo.nome}</strong>? Isso substitui a rotina atual do Cliente pelos dias e exercícios deste
              modelo.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmando(false)}>
                Voltar
              </button>
              <button className="btn-block-primary" style={{ flex: 1 }} onClick={handleConfirmar}>
                Confirmar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
