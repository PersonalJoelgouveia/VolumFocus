import { useState } from 'react';
import { useAlunoStore } from '../../store/useAlunoStore';
import { usePhysicalAssessments } from '../../hooks/usePhysicalAssessments';
import type { AssessmentProtocol, PhysicalAssessment, SkinfoldSet } from '../../types/assessment';
import { SKINFOLD_SITES, type SkinfoldAssessmentPayload } from '../../utils/pollock7';
import { SkinfoldAssessmentForm } from './SkinfoldAssessmentForm';
import { AssessmentTimeline } from './AssessmentTimeline';
import { CompareAssessmentsModal } from './CompareAssessmentsModal';
import { PhysicalAssessmentDashboard } from '../../views/PhysicalAssessmentDashboard';
import './ClientesView.css';
import './AvaliacaoFisicaModal.css';

/** Protocolos do seletor — chave já é o `AssessmentProtocol` do domínio
 *  (types/assessment.ts). Novo protocolo = nova entrada aqui; nada mais
 *  no componente precisa mudar. */
const PROTOCOL_OPTIONS: Array<{
  key: AssessmentProtocol;
  icon: string;
  title: string;
  subtitle: string;
  comingSoon?: boolean;
}> = [
  { key: 'skinfold', icon: '📏', title: 'Dobras', subtitle: 'Avaliação corporal através de medidas manuais' },
  { key: 'bioimpedance', icon: '⚡', title: 'Bioimpedância', subtitle: 'Dados de composição corporal obtidos por bioimpedância' },
  { key: 'online', icon: '☁️', title: 'Online', subtitle: 'Dados enviados/preenchidos pelo aluno', comingSoon: true },
  { key: 'custom', icon: '🛠️', title: 'Personalizada', subtitle: 'Modelo de avaliação adaptável', comingSoon: true },
];

interface AvaliacaoFisicaModalProps {
  alunoId: string;
  onClose: () => void;
  /** Disparado ao escolher um protocolo sem formulário próprio ainda
   *  (Bioimpedância) e sem "Em breve" (Online/Personalizada). Dobras é
   *  tratado internamente, abrindo o SkinfoldAssessmentForm. */
  onSelectProtocol?: (protocol: AssessmentProtocol) => void;
  /** Quando true, oculta ações de escrita — mesma view, uso pelo Aluno.
   *  Bloqueio real de escrita já vem de `canWrite` (role), isto é só UX. */
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
  onSelectProtocol,
  readOnly = false,
}: AvaliacaoFisicaModalProps) {
  const assessments = useAlunoStore((s) => s.getAvaliacoes(alunoId));
  const temHistorico = assessments.length > 0;
  const podeComparar = assessments.length >= 2;
  const { loading, error, retry, canWrite, salvar, remover } = usePhysicalAssessments(alunoId);

  const [step, setStep] = useState<'resumo' | 'protocolo' | 'skinfold-form' | 'evolucao' | 'comparar'>('resumo');

  function handleSelectProtocol(protocol: AssessmentProtocol, comingSoon?: boolean) {
    if (comingSoon) return;
    if (protocol === 'skinfold') {
      setStep('skinfold-form');
      return;
    }
    if (onSelectProtocol) {
      onSelectProtocol(protocol);
    } else {
      console.log('[AvaliacaoFisicaModal] Protocolo selecionado — placeholder', { alunoId, protocol });
    }
  }

  async function handleSaveSkinfold(payload: SkinfoldAssessmentPayload) {
    const now = new Date().toISOString();
    const imc = payload.pesoKg / (payload.alturaCm / 100) ** 2;

    const skinfolds = SKINFOLD_SITES.reduce((acc, site) => {
      const t = payload.triples[site];
      acc[site] = { measurement1: t.m1, measurement2: t.m2, measurement3: t.m3, average: t.media };
      return acc;
    }, {} as SkinfoldSet);

    const assessment: PhysicalAssessment = {
      id: `af-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      alunoId,
      date: now,
      protocol: 'skinfold',
      anthropometry: { peso: payload.pesoKg, altura: payload.alturaCm, imc },
      circumferences: [],
      skinfolds,
      results: {
        percentualGordura: payload.resultado.percentualGordura,
        percentualMassaGorda: payload.resultado.percentualGordura,
        massaGordaKg: payload.resultado.massaGordaKg,
        percentualMassaLegra: payload.resultado.percentualMassaMagra,
        massaMagraKg: payload.resultado.massaMagraKg,
      },
      createdAt: now,
      updatedAt: now,
    };

    await salvar(assessment);
    setStep('resumo');
  }

  if (step === 'skinfold-form') {
    return (
      <SkinfoldAssessmentForm alunoId={alunoId} onCancel={() => setStep('protocolo')} onSave={handleSaveSkinfold} />
    );
  }

  if (step === 'evolucao') {
    return <PhysicalAssessmentDashboard alunoId={alunoId} onClose={() => setStep('resumo')} />;
  }

  if (step === 'comparar') {
    return <CompareAssessmentsModal alunoId={alunoId} onClose={() => setStep('resumo')} />;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="cli-detail-panel af-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          {step === 'protocolo' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="af-back-btn" onClick={() => setStep('resumo')} aria-label="Voltar">
                ‹
              </button>
              <h2 style={{ marginBottom: 0 }}>Escolha o protocolo</h2>
            </div>
          ) : (
            <h2 style={{ marginBottom: 0 }}>Avaliação Física</h2>
          )}
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        {step === 'resumo' ? (
          <>
            {loading && <div className="af-empty">Carregando histórico…</div>}

            {!loading && error && (
              <div className="af-last-card af-last-card--erro">
                <div className="af-empty">{error}</div>
                <button className="btn btn-ghost af-retry-btn" onClick={retry}>
                  Tentar novamente
                </button>
              </div>
            )}

            {!loading && !error && (
              <>
                <div className="af-actions">
                  <button
                    className="btn btn-ghost"
                    disabled={!temHistorico}
                    onClick={() => setStep('evolucao')}
                    title={temHistorico ? undefined : 'Registre a primeira avaliação para ver a evolução'}
                  >
                    Ver evolução
                  </button>
                  {!readOnly && canWrite && (
                    <button className="btn btn-primary" onClick={() => setStep('protocolo')}>
                      + Nova avaliação
                    </button>
                  )}
                </div>

                {podeComparar && (
                  <button className="btn btn-ghost af-comparar-btn" onClick={() => setStep('comparar')}>
                    ⇄ Comparar avaliações
                  </button>
                )}

                <AssessmentTimeline
                  assessments={assessments}
                  canWrite={canWrite}
                  onRemover={remover}
                  onNovaAvaliacao={!readOnly && canWrite ? () => setStep('protocolo') : undefined}
                />
              </>
            )}
          </>
        ) : (
          <div className="af-protocol-list">
            {PROTOCOL_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                className={`af-protocol-card${opt.comingSoon ? ' af-protocol-card--soon' : ''}`}
                onClick={() => handleSelectProtocol(opt.key, opt.comingSoon)}
                disabled={opt.comingSoon}
              >
                <span className="af-protocol-icon" aria-hidden="true">{opt.icon}</span>
                <span className="af-protocol-text">
                  <span className="af-protocol-title">{opt.title}</span>
                  <span className="af-protocol-subtitle">{opt.subtitle}</span>
                </span>
                {opt.comingSoon ? (
                  <span className="af-protocol-badge">Em breve</span>
                ) : (
                  <span className="af-protocol-chevron" aria-hidden="true">›</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
