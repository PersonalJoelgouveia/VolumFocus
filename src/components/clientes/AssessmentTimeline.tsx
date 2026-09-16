import { useState } from 'react';
import { useUIStore } from '../../store/useUIStore';
import type { AssessmentProtocol, PhysicalAssessment } from '../../types/assessment';
import { SKINFOLD_SITES, SKINFOLD_SITE_LABELS } from '../../utils/pollock7';
import { formatarDataCurta } from '../../utils/timelineDate';
import './AssessmentTimeline.css';

const PROTOCOL_LABELS: Record<AssessmentProtocol, string> = {
  skinfold: 'Dobras',
  bioimpedance: 'Bioimpedância',
  online: 'Online',
  custom: 'Personalizada',
};

interface AssessmentTimelineProps {
  assessments: PhysicalAssessment[];
  /** true só pro Personal — Aluno vê a timeline, mas sem editar/remover. */
  canWrite: boolean;
  /** Já cuida de confirmação + atualização otimista + toast (usePhysicalAssessments). */
  onRemover: (assessmentId: string) => void;
  /** Sem edição própria ainda — sem essa prop, o botão avisa por toast. */
  onEditar?: (assessment: PhysicalAssessment) => void;
  /** CTA de dentro do estado vazio. */
  onNovaAvaliacao?: () => void;
  /** Abre a revisão do Personal — só relevante para avaliações Online com status 'enviada'. */
  onRevisar?: (assessmentId: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  em_preenchimento: 'Em preenchimento',
  enviada: 'Enviada pelo aluno',
  revisada: 'Revisada',
};

/**
 * Timeline visual do histórico de Avaliação Física. Só apresentação —
 * ordena e exibe o que já vem de useAlunoStore/usePhysicalAssessments;
 * confirmação de exclusão e sincronização com o Firestore continuam no
 * hook (não duplicadas aqui).
 */
export function AssessmentTimeline({ assessments, canWrite, onRemover, onEditar, onNovaAvaliacao, onRevisar }: AssessmentTimelineProps) {
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const showToast = useUIStore((s) => s.showToast);

  function handleEditar(assessment: PhysicalAssessment) {
    if (onEditar) {
      onEditar(assessment);
    } else {
      showToast('Edição de avaliação ainda não disponível.', 'info');
    }
  }

  if (assessments.length === 0) {
    return (
      <div className="at-empty">
        <p>Este aluno ainda não possui avaliações físicas.</p>
        {onNovaAvaliacao && (
          <button type="button" className="btn btn-primary at-empty-cta" onClick={onNovaAvaliacao}>
            + Nova avaliação
          </button>
        )}
      </div>
    );
  }

  const ordenadas = [...assessments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="at-timeline">
      {ordenadas.map((a, i) => {
        const expandido = expandidoId === a.id;
        const temCircunferencias = a.circumferences.length > 0;
        const temBio = a.results.gorduraVisceral != null || a.results.metabolismoBasal != null;

        return (
          <div key={a.id} className="at-item">
            <div className="at-line" aria-hidden="true">
              <div className="at-dot" />
              {i < ordenadas.length - 1 && <div className="at-connector" />}
            </div>

            <div className="at-card">
              <div className="at-card-header">
                <span className="at-date">{formatarDataCurta(a.date)}</span>
                <span className="at-badge">{PROTOCOL_LABELS[a.protocol]}</span>
                {a.status && <span className={`at-badge at-badge--status-${a.status}`}>{STATUS_LABELS[a.status]}</span>}
              </div>

              <div className="at-metrics">
                <div className="at-metric">
                  <span>Peso</span>
                  <strong>{a.anthropometry.peso.toFixed(1)} kg</strong>
                </div>
                {a.results.percentualGordura != null && (
                  <div className="at-metric">
                    <span>% Gordura</span>
                    <strong>{a.results.percentualGordura.toFixed(1)}%</strong>
                  </div>
                )}
                {a.results.massaMagraKg != null && (
                  <div className="at-metric">
                    <span>Massa magra</span>
                    <strong>{a.results.massaMagraKg.toFixed(1)} kg</strong>
                  </div>
                )}
                {a.results.relacaoCinturaQuadril != null && (
                  <div className="at-metric">
                    <span>RCQ</span>
                    <strong>{a.results.relacaoCinturaQuadril.toFixed(2)}</strong>
                  </div>
                )}
                {a.results.relacaoCinturaEstatura != null && (
                  <div className="at-metric">
                    <span>RCE</span>
                    <strong>{a.results.relacaoCinturaEstatura.toFixed(2)}</strong>
                  </div>
                )}
                <div className="at-metric">
                  <span>IMC</span>
                  <strong>{a.anthropometry.imc.toFixed(1)}</strong>
                </div>
              </div>

              {expandido && (
                <div className="at-detail">
                  {a.protocol === 'skinfold' && (
                    <div className="at-detail-section">
                      <div className="at-detail-title">Dobras (mm)</div>
                      <div className="at-detail-grid">
                        {SKINFOLD_SITES.map((site) => (
                          <div key={site} className="at-detail-row">
                            <span>{SKINFOLD_SITE_LABELS[site]}</span>
                            <strong>{a.skinfolds[site].average.toFixed(2)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {temCircunferencias && (
                    <div className="at-detail-section">
                      <div className="at-detail-title">Circunferências (cm)</div>
                      <div className="at-detail-grid">
                        {a.circumferences.map((c) => (
                          <div key={c.id} className="at-detail-row">
                            <span>{c.nome}</span>
                            <strong>{c.valor.toFixed(1)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {temBio && (
                    <div className="at-detail-section">
                      <div className="at-detail-title">Bioimpedância</div>
                      <div className="at-detail-grid">
                        {a.results.gorduraVisceral != null && (
                          <div className="at-detail-row">
                            <span>Gordura visceral</span>
                            <strong>{a.results.gorduraVisceral}</strong>
                          </div>
                        )}
                        {a.results.metabolismoBasal != null && (
                          <div className="at-detail-row">
                            <span>TMB</span>
                            <strong>{a.results.metabolismoBasal} kcal/dia</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {a.notes && (
                    <div className="at-detail-section">
                      <div className="at-detail-title">Notas</div>
                      <p className="at-detail-notes">{a.notes}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="at-actions">
                <button
                  type="button"
                  className="btn btn-ghost at-ver-btn"
                  onClick={() => setExpandidoId(expandido ? null : a.id)}
                >
                  {expandido ? 'Ocultar' : 'Ver avaliação'}
                </button>
                {canWrite && a.status === 'enviada' && onRevisar && (
                  <button type="button" className="btn btn-primary at-revisar-btn" onClick={() => onRevisar(a.id)}>
                    Revisar
                  </button>
                )}
                {canWrite && (
                  <>
                    <button
                      type="button"
                      className="at-icon-btn"
                      onClick={() => handleEditar(a)}
                      aria-label="Editar avaliação"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="at-icon-btn at-icon-btn--danger"
                      onClick={() => onRemover(a.id)}
                      aria-label="Remover avaliação"
                    >
                      🗑️
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
