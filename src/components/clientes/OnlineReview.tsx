import { useState } from 'react';
import type { PhysicalAssessment } from '../../types/assessment';
import { classificarIMC, classificarRCE, TRIAGEM_SAUDE_ITENS } from '../../utils/onlineAssessment';
import './OnlineAssessmentForm.css';

interface OnlineReviewProps {
  assessment: PhysicalAssessment;
  /** 'aluno' = tela de revisão antes de enviar. 'personal' = revisão de
   *  uma avaliação já enviada (mesmo layout, ações diferentes). */
  mode: 'aluno' | 'personal';
  onVoltar?: () => void;
  onEnviar?: () => void;
  onMarcarRevisada?: (nota: string) => void;
  enviando?: boolean;
}

/** Uma linha de dado com a origem explícita — seção 18: diferenciar
 *  "Informado pelo aluno" / "Medido pelo aluno" / "Calculado pelo
 *  VolumFocus" é obrigatório na revisão. */
function LinhaOrigem({ label, valor, origem }: { label: string; valor: string; origem: 'informado' | 'medido' | 'calculado' }) {
  const origemLabel = { informado: 'Informado pelo aluno', medido: 'Medido pelo aluno', calculado: 'Calculado pelo VolumFocus' }[origem];
  return (
    <div className="oa-review-row">
      <span className="oa-review-label">{label}</span>
      <span className="oa-review-valor">{valor}</span>
      <span className="oa-review-origem">{origemLabel}</span>
    </div>
  );
}

export function OnlineReview({ assessment, mode, onVoltar, onEnviar, onMarcarRevisada, enviando }: OnlineReviewProps) {
  const [nota, setNota] = useState('');
  const imcClass = classificarIMC(assessment.anthropometry.imc);
  const rceClass =
    assessment.results.relacaoCinturaEstatura != null
      ? classificarRCE(assessment.results.relacaoCinturaEstatura, assessment.anthropometry.imc)
      : null;

  const respostasPositivas = TRIAGEM_SAUDE_ITENS.filter((item) => assessment.questionnaire?.triagemSaude?.[item.key]);

  return (
    <div className="oa-step">
      <h3 className="oa-step-title">{mode === 'aluno' ? 'Revisão' : 'Revisar avaliação'}</h3>
      {assessment.status && <span className={`oa-status-badge oa-status-badge--${assessment.status}`}>{STATUS_LABEL[assessment.status]}</span>}

      <div className="oa-review-section">
        <div className="oa-review-title">Antropometria</div>
        <LinhaOrigem label="Peso" valor={`${assessment.anthropometry.peso.toFixed(1)} kg`} origem="informado" />
        <LinhaOrigem label="Altura" valor={`${assessment.anthropometry.altura.toFixed(1)} cm`} origem="informado" />
        <LinhaOrigem label="IMC" valor={`${assessment.anthropometry.imc.toFixed(1)} (${imcClass.label})`} origem="calculado" />
      </div>

      {assessment.circumferences.length > 0 && (
        <div className="oa-review-section">
          <div className="oa-review-title">Circunferências</div>
          {assessment.circumferences.map((c) => (
            <LinhaOrigem key={c.id} label={c.nome} valor={`${c.valor.toFixed(1)} cm${c.measurementMethod ? ` · ${c.measurementMethod === 'WHO_STEPS' ? 'WHO STEPS' : c.measurementMethod}` : ''}`} origem="medido" />
          ))}
        </div>
      )}

      {(assessment.results.relacaoCinturaQuadril != null || assessment.results.relacaoCinturaEstatura != null) && (
        <div className="oa-review-section">
          <div className="oa-review-title">Indicadores derivados</div>
          {assessment.results.relacaoCinturaQuadril != null && (
            <LinhaOrigem label="RCQ" valor={assessment.results.relacaoCinturaQuadril.toFixed(2)} origem="calculado" />
          )}
          {assessment.results.relacaoCinturaEstatura != null && rceClass && (
            <LinhaOrigem label="RCE" valor={`${assessment.results.relacaoCinturaEstatura.toFixed(2)} — ${rceClass.label}`} origem="calculado" />
          )}
          {rceClass?.limitacao && <p className="oa-note">{rceClass.limitacao}</p>}
        </div>
      )}

      {assessment.notes && (
        <div className="oa-review-section">
          <div className="oa-review-title">Dados básicos</div>
          <p className="oa-note">{assessment.notes} — <em>Informado pelo aluno</em></p>
        </div>
      )}

      {assessment.questionnaire && Object.keys(assessment.questionnaire).length > 0 && (
        <div className="oa-review-section">
          <div className="oa-review-title">Contexto (informação relatada pelo aluno)</div>
          {respostasPositivas.length > 0 ? (
            <p className="oa-note">Sinalizou: {respostasPositivas.map((r) => r.pergunta).join('; ')}</p>
          ) : (
            <p className="oa-note">Nenhum item de triagem sinalizado.</p>
          )}
        </div>
      )}

      {mode === 'aluno' && (
        <div className="oa-actions">
          {onVoltar && (
            <button type="button" className="btn btn-ghost" onClick={onVoltar}>
              Voltar
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={onEnviar} disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar avaliação'}
          </button>
        </div>
      )}

      {mode === 'personal' && assessment.status === 'enviada' && (
        <div className="oa-review-section">
          <div className="oa-review-title">Observação da revisão</div>
          <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} placeholder="Opcional" />
          <div className="oa-actions">
            <button type="button" className="btn btn-primary" onClick={() => onMarcarRevisada?.(nota)}>
              Marcar como revisada
            </button>
          </div>
        </div>
      )}

      {mode === 'personal' && assessment.review && (
        <div className="oa-review-section">
          <div className="oa-review-title">Revisado por</div>
          <p className="oa-note">
            {assessment.review.reviewedBy} em {new Date(assessment.review.reviewedAt).toLocaleDateString('pt-BR')}
            {assessment.review.reviewNote ? ` — "${assessment.review.reviewNote}"` : ''}
          </p>
        </div>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  em_preenchimento: 'Em preenchimento',
  enviada: 'Enviada pelo aluno',
  revisada: 'Revisada pelo Personal',
};
