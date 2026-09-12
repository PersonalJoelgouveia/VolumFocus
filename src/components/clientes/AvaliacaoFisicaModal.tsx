import { useAlunoStore } from '../../store/useAlunoStore';
import './ClientesView.css';
import './AvaliacaoFisicaModal.css';

interface AvaliacaoFisicaModalProps {
  alunoId: string;
  onClose: () => void;
  /** Deixa a criação de avaliação a cargo de quem renderiza o modal — hoje é
   *  um placeholder no fluxo do Personal; futuramente pode ser omitido/
   *  substituído para o app do Aluno (que só visualiza). */
  onNovaAvaliacao?: () => void;
  /** Navegação para o dashboard de evolução (fora do escopo desta etapa). */
  onVerEvolucao?: () => void;
  /** Quando true, oculta ações de escrita — mesma view, uso pelo Aluno. */
  readOnly?: boolean;
}

/**
 * Escopo inicial do módulo "Avaliação Física": resumo da última avaliação +
 * atalhos para histórico/evolução e nova avaliação. Sem acoplamento ao papel
 * de quem visualiza — lê apenas de `useAlunoStore` por `alunoId`, mesma
 * fonte que servirá o app do Aluno mais adiante.
 */
export function AvaliacaoFisicaModal({
  alunoId,
  onClose,
  onNovaAvaliacao,
  onVerEvolucao,
  readOnly = false,
}: AvaliacaoFisicaModalProps) {
  const ultimaAvaliacao = useAlunoStore((s) => s.getUltimaAvaliacao(alunoId));
  const temHistorico = !!ultimaAvaliacao;

  const dataFormatada = ultimaAvaliacao
    ? new Date(ultimaAvaliacao.date).toLocaleDateString('pt-BR')
    : null;

  function handleNovaAvaliacao() {
    if (onNovaAvaliacao) {
      onNovaAvaliacao();
    } else {
      console.log('[AvaliacaoFisicaModal] Nova avaliação — placeholder', { alunoId });
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="cli-detail-panel af-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ marginBottom: 0 }}>Avaliação Física</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="af-last-card">
          <div className="af-last-label">Última avaliação</div>
          {temHistorico ? (
            <div className="af-last-value">{dataFormatada}</div>
          ) : (
            <div className="af-empty">Nenhuma avaliação registrada.</div>
          )}
        </div>

        <div className="af-actions">
          <button
            className="btn btn-ghost"
            disabled={!temHistorico}
            onClick={onVerEvolucao}
            title={temHistorico ? undefined : 'Registre a primeira avaliação para ver a evolução'}
          >
            Ver evolução
          </button>
          {!readOnly && (
            <button className="btn btn-primary" onClick={handleNovaAvaliacao}>
              + Nova avaliação
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
