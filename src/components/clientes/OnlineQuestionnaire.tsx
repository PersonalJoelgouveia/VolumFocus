import {
  MENSAGEM_ORIENTACAO_PROFISSIONAL,
  TRIAGEM_SAUDE_ITENS,
  precisaOrientacaoProfissional,
} from '../../utils/onlineAssessment';
import type { OnlineQuestionnaireData } from '../../types/assessment';
import './OnlineAssessmentForm.css';

interface OnlineQuestionnaireProps {
  value: OnlineQuestionnaireData;
  onChange: (value: OnlineQuestionnaireData) => void;
}

/**
 * "Contexto da avaliação" (opcional) + triagem inicial simples de saúde.
 * Tudo aqui é informação relatada pelo aluno — nunca vira diagnóstico, e
 * fica sempre rotulado como tal na Revisão (OnlineReview). A triagem
 * nunca é vista por outro aluno e nunca alimenta um diagnóstico
 * automático — só decide se a mensagem neutra de orientação aparece.
 */
export function OnlineQuestionnaire({ value, onChange }: OnlineQuestionnaireProps) {
  function set<K extends keyof OnlineQuestionnaireData>(campo: K, v: OnlineQuestionnaireData[K]) {
    onChange({ ...value, [campo]: v });
  }

  function setTriagem(key: string, v: boolean) {
    onChange({ ...value, triagemSaude: { ...value.triagemSaude, [key]: v } });
  }

  const precisaOrientacao = precisaOrientacaoProfissional(value.triagemSaude);

  return (
    <div className="oa-step">
      <h3 className="oa-step-title">Contexto da avaliação (opcional)</h3>
      <p className="oa-note">Informação relatada pelo aluno — não é uma medida objetiva.</p>

      <div className="oa-field">
        <label>Nível de atividade física</label>
        <input type="text" value={value.nivelAtividade ?? ''} onChange={(e) => set('nivelAtividade', e.target.value)} placeholder="Ex: moderado" />
      </div>

      <div className="oa-field">
        <label>Frequência semanal de treino (dias)</label>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={7}
          value={value.frequenciaSemanalTreino ?? ''}
          onChange={(e) => set('frequenciaSemanalTreino', e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </div>

      <div className="oa-field">
        <label>Modalidade principal</label>
        <input type="text" value={value.modalidadePrincipal ?? ''} onChange={(e) => set('modalidadePrincipal', e.target.value)} placeholder="Ex: musculação" />
      </div>

      <div className="oa-field">
        <label>Horas aproximadas de sono</label>
        <input
          type="number"
          inputMode="decimal"
          step={0.5}
          min={0}
          max={24}
          value={value.horasSono ?? ''}
          onChange={(e) => set('horasSono', e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </div>

      <div className="oa-field">
        <label>Percepção de qualidade do sono</label>
        <input type="text" value={value.qualidadeSono ?? ''} onChange={(e) => set('qualidadeSono', e.target.value)} placeholder="Ex: boa" />
      </div>

      <div className="oa-field">
        <label>Tempo sentado por dia (horas)</label>
        <input
          type="number"
          inputMode="decimal"
          step={0.5}
          min={0}
          max={24}
          value={value.tempoSentadoHoras ?? ''}
          onChange={(e) => set('tempoSentadoHoras', e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </div>

      <div className="oa-field">
        <label>Frequência aproximada de atividade aeróbia</label>
        <input type="text" value={value.frequenciaAerobica ?? ''} onChange={(e) => set('frequenciaAerobica', e.target.value)} placeholder="Ex: 3x por semana" />
      </div>

      <div className="oa-field">
        <label>Histórico de treinamento</label>
        <textarea value={value.historicoTreinamento ?? ''} onChange={(e) => set('historicoTreinamento', e.target.value)} rows={2} />
      </div>

      <div className="oa-field">
        <label>Observações</label>
        <textarea value={value.observacoes ?? ''} onChange={(e) => set('observacoes', e.target.value)} rows={2} />
      </div>

      <h3 className="oa-step-title" style={{ marginTop: 20 }}>Saúde e segurança (opcional)</h3>
      <p className="oa-note">Não substitui avaliação médica. Suas respostas nunca ficam visíveis para outro aluno.</p>

      {TRIAGEM_SAUDE_ITENS.map((item) => (
        <div key={item.key} className="oa-triagem-item">
          <span>{item.pergunta}</span>
          <div className="oa-toggle-row">
            <button
              type="button"
              className={`oa-toggle-opt${value.triagemSaude?.[item.key] === true ? ' active' : ''}`}
              onClick={() => setTriagem(item.key, true)}
            >
              Sim
            </button>
            <button
              type="button"
              className={`oa-toggle-opt${value.triagemSaude?.[item.key] === false ? ' active' : ''}`}
              onClick={() => setTriagem(item.key, false)}
            >
              Não
            </button>
          </div>
        </div>
      ))}

      {precisaOrientacao && <div className="oa-alert oa-alert-info">{MENSAGEM_ORIENTACAO_PROFISSIONAL}</div>}
    </div>
  );
}
