import { useState } from 'react';
import { useAlunoStore } from '../../store/useAlunoStore';
import type { AssessmentProtocol } from '../../types/assessment';
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
  /** Disparado ao escolher um protocolo sem "Em breve" (Dobras/Bioimpedância).
   *  Hoje é placeholder/log; formulários por protocolo entram depois sem
   *  tocar neste componente. */
  onSelectProtocol?: (protocol: AssessmentProtocol) => void;
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
  onSelectProtocol,
  onVerEvolucao,
  readOnly = false,
}: AvaliacaoFisicaModalProps) {
  const ultimaAvaliacao = useAlunoStore((s) => s.getUltimaAvaliacao(alunoId));
  const temHistorico = !!ultimaAvaliacao;

  const dataFormatada = ultimaAvaliacao
    ? new Date(ultimaAvaliacao.date).toLocaleDateString('pt-BR')
    : null;

  const [step, setStep] = useState<'resumo' | 'protocolo'>('resumo');

  function handleSelectProtocol(protocol: AssessmentProtocol, comingSoon?: boolean) {
    if (comingSoon) return;
    if (onSelectProtocol) {
      onSelectProtocol(protocol);
    } else {
      console.log('[AvaliacaoFisicaModal] Protocolo selecionado — placeholder', { alunoId, protocol });
    }
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
                <button className="btn btn-primary" onClick={() => setStep('protocolo')}>
                  + Nova avaliação
                </button>
              )}
            </div>
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
