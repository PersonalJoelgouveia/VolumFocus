import { useState } from 'react';
import { useAlunoStore } from '../../store/useAlunoStore';
import type { AssessmentProtocol } from '../../types/assessment';
import {
  compararAvaliacoes,
  formatarDiferencaDescritiva,
  formatarValorComparacao,
  type DirecaoIndicador,
} from '../../utils/compareAssessments';
import { formatarDataCurta } from '../../utils/timelineDate';
import './ClientesView.css';
import './CompareAssessmentsModal.css';

interface CompareAssessmentsModalProps {
  alunoId: string;
  onClose: () => void;
}

const PROTOCOL_LABELS: Record<AssessmentProtocol, string> = {
  skinfold: 'Dobras',
  bioimpedance: 'Bioimpedância',
  online: 'Online',
  custom: 'Personalizada',
};

const ICONE_DIRECAO: Record<DirecaoIndicador, string> = { reducao: '↓', aumento: '↑', estavel: '→' };
const LABEL_DIRECAO: Record<DirecaoIndicador, string> = { reducao: 'Redução', aumento: 'Aumento', estavel: 'Estável' };

const LABELS_RESUMO = ['Peso', '% Gordura', 'Massa magra'];

/**
 * Módulo "Comparar Avaliações": escolha livre de quaisquer duas avaliações
 * (não fixo em primeira/atual). Indicadores de direção são neutros de
 * propósito — mesma cor pra redução/aumento/estabilidade, só o ícone muda —
 * porque nem toda redução é positiva nem todo aumento é negativo. Não faz
 * nenhuma leitura clínica, só descreve a diferença.
 *
 * Isolado: só lê de useAlunoStore (nenhuma escrita, nenhum outro módulo tocado).
 */
export function CompareAssessmentsModal({ alunoId, onClose }: CompareAssessmentsModalProps) {
  const assessments = useAlunoStore((s) => s.getAvaliacoes(alunoId));
  const ordenadas = [...assessments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const [idA, setIdA] = useState(ordenadas[0]?.id ?? '');
  const [idB, setIdB] = useState(ordenadas[ordenadas.length - 1]?.id ?? '');

  if (ordenadas.length < 2) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="cli-detail-panel cmp-panel" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2 style={{ marginBottom: 0 }}>Comparar avaliações</h2>
            <button className="modal-close" onClick={onClose} aria-label="Fechar">
              ×
            </button>
          </div>
          <div className="cmp-empty">Precisa de pelo menos 2 avaliações registradas para comparar.</div>
        </div>
      </div>
    );
  }

  const opcoes = (excluirId: string) =>
    ordenadas.map((a) => ({
      id: a.id,
      texto: `${formatarDataCurta(a.date)} — ${PROTOCOL_LABELS[a.protocol]}`,
      disabled: a.id === excluirId,
    }));

  const assessmentA = ordenadas.find((a) => a.id === idA);
  const assessmentB = ordenadas.find((a) => a.id === idB);
  const mesmaSelecao = idA === idB;

  let itens: ReturnType<typeof compararAvaliacoes> = [];
  let inicial = assessmentA;
  let atual = assessmentB;

  if (assessmentA && assessmentB && !mesmaSelecao) {
    [inicial, atual] =
      new Date(assessmentA.date).getTime() <= new Date(assessmentB.date).getTime()
        ? [assessmentA, assessmentB]
        : [assessmentB, assessmentA];
    itens = compararAvaliacoes(inicial, atual);
  }

  const itensResumo = itens.filter((i) => LABELS_RESUMO.includes(i.label));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="cli-detail-panel cmp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ marginBottom: 0 }}>Comparar avaliações</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="cmp-pickers">
          <div className="cmp-picker-field">
            <label htmlFor="cmp-select-a">Avaliação 1</label>
            <select id="cmp-select-a" value={idA} onChange={(e) => setIdA(e.target.value)}>
              {opcoes(idB).map((o) => (
                <option key={o.id} value={o.id} disabled={o.disabled}>
                  {o.texto}
                </option>
              ))}
            </select>
          </div>
          <div className="cmp-picker-field">
            <label htmlFor="cmp-select-b">Avaliação 2</label>
            <select id="cmp-select-b" value={idB} onChange={(e) => setIdB(e.target.value)}>
              {opcoes(idA).map((o) => (
                <option key={o.id} value={o.id} disabled={o.disabled}>
                  {o.texto}
                </option>
              ))}
            </select>
          </div>
        </div>

        {mesmaSelecao ? (
          <div className="cmp-empty">Selecione duas avaliações diferentes para comparar.</div>
        ) : (
          <>
            {itensResumo.length > 0 && inicial && atual && (
              <div className="cmp-snapshot">
                <div className="cmp-snapshot-header">
                  <span>{formatarDataCurta(inicial.date)}</span>
                  <span>{formatarDataCurta(atual.date)}</span>
                </div>
                {itensResumo.map((i) => (
                  <div key={i.label} className="cmp-snapshot-row">
                    <span>{formatarValorComparacao(i.valorInicial, i.unidade)}</span>
                    <span>{formatarValorComparacao(i.valorAtual, i.unidade)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="cmp-evolucao">
              <h3 className="cmp-section-title">Evolução</h3>

              {itens.length === 0 ? (
                <div className="cmp-empty">Nenhuma métrica em comum entre essas duas avaliações.</div>
              ) : (
                itens.map((i) => (
                  <div key={i.label} className="cmp-item">
                    <span className="cmp-item-icone" aria-hidden="true">
                      {ICONE_DIRECAO[i.direcao]}
                    </span>
                    <span className="cmp-item-label">{i.label}</span>
                    <span className="cmp-item-valor">{formatarDiferencaDescritiva(i.diferenca, i.unidadeDiferenca)}</span>
                    <span className="cmp-item-tag">{LABEL_DIRECAO[i.direcao]}</span>
                  </div>
                ))
              )}

              <p className="cmp-disclaimer">
                Leitura puramente descritiva — redução e aumento não indicam, por si só, melhora ou piora. Não substitui
                avaliação profissional.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
