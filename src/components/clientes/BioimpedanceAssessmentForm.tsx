import { useState } from 'react';
import {
  calcIMC,
  calcMassaGorda,
  calcMassaMagra,
  calcularBioimpedancia,
  validarInputsBioimpedancia,
  type BioimpedanceResult,
  type OrigemValor,
} from '../../utils/bioimpedance';
import './ClientesView.css';
import './BioimpedanceAssessmentForm.css';

export interface BioimpedanceAssessmentPayload {
  pesoKg: number;
  alturaCm: number;
  percentualGordura: number;
  percentualMassaMagra: number;
  gorduraVisceral: number;
  metabolismoBasal: number;
  massaGordaOrigem: OrigemValor;
  massaMagraOrigem: OrigemValor;
  resultado: BioimpedanceResult;
}

interface BioimpedanceAssessmentFormProps {
  onCancel: () => void;
  /** Chamado com o payload confirmado na etapa de revisão. Sem `onSave`,
   *  cai num console.log — quem renderiza decide como/onde persistir. */
  onSave?: (payload: BioimpedanceAssessmentPayload) => void;
}

/**
 * Formulário do protocolo "Bioimpedância". Implementação isolada: não
 * importa nenhum outro módulo do app (sem useAlunoStore, sem
 * types/assessment.ts) — só os cálculos puros de utils/bioimpedance.ts.
 *
 * %Gordura, %Massa Magra, Gordura Visceral e TMB vêm direto do aparelho
 * (não há fórmula pra estimá-los aqui). IMC é sempre calculado. Massa
 * Gorda/Massa Magra são calculadas a partir do percentual por padrão, mas
 * aceitam sobrescrita manual (aparelho que já informa o valor absoluto em
 * kg) — editar o campo direto muda o modo pra "manual" e a auto-atualização
 * pára pra aquele campo até o usuário voltar pro modo calculado.
 */
export function BioimpedanceAssessmentForm({ onCancel, onSave }: BioimpedanceAssessmentFormProps) {
  const [peso, setPeso] = useState('');
  const [altura, setAltura] = useState('');
  const [percentualGordura, setPercentualGordura] = useState('');
  const [percentualMassaMagra, setPercentualMassaMagra] = useState('');
  const [gorduraVisceral, setGorduraVisceral] = useState('');
  const [metabolismoBasal, setMetabolismoBasal] = useState('');

  const [massaGordaModo, setMassaGordaModo] = useState<OrigemValor>('calculado');
  const [massaGordaManual, setMassaGordaManual] = useState('');
  const [massaMagraModo, setMassaMagraModo] = useState<OrigemValor>('calculado');
  const [massaMagraManual, setMassaMagraManual] = useState('');

  const [etapa, setEtapa] = useState<'formulario' | 'confirmacao'>('formulario');
  const [tentouRevisar, setTentouRevisar] = useState(false);

  const pesoNum = peso === '' ? undefined : Number(peso);
  const alturaNum = altura === '' ? undefined : Number(altura);
  const percentualGorduraNum = percentualGordura === '' ? undefined : Number(percentualGordura);
  const percentualMassaMagraNum = percentualMassaMagra === '' ? undefined : Number(percentualMassaMagra);
  const gorduraVisceralNum = gorduraVisceral === '' ? undefined : Number(gorduraVisceral);
  const metabolismoBasalNum = metabolismoBasal === '' ? undefined : Number(metabolismoBasal);

  const massaGordaCalculada =
    pesoNum != null && percentualGorduraNum != null ? calcMassaGorda(pesoNum, percentualGorduraNum) : undefined;
  const massaMagraCalculada =
    pesoNum != null && percentualMassaMagraNum != null ? calcMassaMagra(pesoNum, percentualMassaMagraNum) : undefined;

  const massaGordaEfetiva =
    massaGordaModo === 'manual' ? (massaGordaManual === '' ? undefined : Number(massaGordaManual)) : massaGordaCalculada;
  const massaMagraEfetiva =
    massaMagraModo === 'manual' ? (massaMagraManual === '' ? undefined : Number(massaMagraManual)) : massaMagraCalculada;

  const imc = pesoNum != null && alturaNum != null ? calcIMC(pesoNum, alturaNum) : undefined;

  const erros = validarInputsBioimpedancia({
    pesoKg: pesoNum,
    alturaCm: alturaNum,
    percentualGordura: percentualGorduraNum,
    percentualMassaMagra: percentualMassaMagraNum,
    gorduraVisceral: gorduraVisceralNum,
    metabolismoBasal: metabolismoBasalNum,
    massaGordaKg: massaGordaEfetiva,
    massaMagraKg: massaMagraEfetiva,
  });
  const podeRevisar = erros.length === 0;

  function erroDoCampo(campo: string) {
    return tentouRevisar ? erros.find((e) => e.field === campo)?.message : undefined;
  }

  function handleEditarMassaGorda(valor: string) {
    setMassaGordaModo('manual');
    setMassaGordaManual(valor);
  }

  function handleEditarMassaMagra(valor: string) {
    setMassaMagraModo('manual');
    setMassaMagraManual(valor);
  }

  function handleRevisar() {
    setTentouRevisar(true);
    if (!podeRevisar) return;
    setEtapa('confirmacao');
  }

  function handleConfirmar() {
    if (
      pesoNum == null ||
      alturaNum == null ||
      percentualGorduraNum == null ||
      percentualMassaMagraNum == null ||
      gorduraVisceralNum == null ||
      metabolismoBasalNum == null ||
      massaGordaEfetiva == null ||
      massaMagraEfetiva == null
    ) {
      return;
    }

    const resultado = calcularBioimpedancia(pesoNum, alturaNum, percentualGorduraNum, percentualMassaMagraNum, {
      massaGordaKg: massaGordaModo === 'manual' ? massaGordaEfetiva : undefined,
      massaMagraKg: massaMagraModo === 'manual' ? massaMagraEfetiva : undefined,
    });

    const payload: BioimpedanceAssessmentPayload = {
      pesoKg: pesoNum,
      alturaCm: alturaNum,
      percentualGordura: percentualGorduraNum,
      percentualMassaMagra: percentualMassaMagraNum,
      gorduraVisceral: gorduraVisceralNum,
      metabolismoBasal: metabolismoBasalNum,
      massaGordaOrigem: massaGordaModo,
      massaMagraOrigem: massaMagraModo,
      resultado,
    };

    if (onSave) {
      onSave(payload);
    } else {
      console.log('[BioimpedanceAssessmentForm] Avaliação confirmada — placeholder', payload);
    }
  }

  if (etapa === 'confirmacao') {
    return (
      <div className="modal-backdrop" onClick={onCancel}>
        <div className="cli-detail-panel bf-panel" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2 style={{ marginBottom: 0 }}>Confirmar avaliação</h2>
            <button className="modal-close" onClick={onCancel} aria-label="Fechar">
              ×
            </button>
          </div>

          <div className="bf-summary">
            <div className="bf-summary-row">
              <span>Peso</span>
              <strong>{pesoNum?.toFixed(1)} kg</strong>
            </div>
            <div className="bf-summary-row">
              <span>IMC</span>
              <strong>{imc?.toFixed(2)}</strong>
            </div>
            <div className="bf-summary-row">
              <span>% de gordura</span>
              <strong>{percentualGorduraNum?.toFixed(1)}%</strong>
            </div>
            <div className="bf-summary-row">
              <span>Massa gorda</span>
              <strong>
                {massaGordaEfetiva?.toFixed(2)} kg{massaGordaModo === 'manual' ? ' (manual)' : ''}
              </strong>
            </div>
            <div className="bf-summary-row">
              <span>% de massa magra</span>
              <strong>{percentualMassaMagraNum?.toFixed(1)}%</strong>
            </div>
            <div className="bf-summary-row">
              <span>Massa magra</span>
              <strong>
                {massaMagraEfetiva?.toFixed(2)} kg{massaMagraModo === 'manual' ? ' (manual)' : ''}
              </strong>
            </div>
            <div className="bf-summary-row">
              <span>Gordura visceral</span>
              <strong>{gorduraVisceralNum}</strong>
            </div>
            <div className="bf-summary-row">
              <span>Taxa metabólica basal</span>
              <strong>{metabolismoBasalNum} kcal/dia</strong>
            </div>
          </div>

          <div className="bf-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setEtapa('formulario')}>
              Voltar e editar
            </button>
            <button type="button" className="btn btn-primary" onClick={handleConfirmar}>
              Confirmar e salvar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="cli-detail-panel bf-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ marginBottom: 0 }}>Bioimpedância</h2>
          <button className="modal-close" onClick={onCancel} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="bf-fields">
          <div className="bf-field">
            <label htmlFor="bf-peso">Peso (kg)</label>
            <input
              id="bf-peso"
              type="number"
              inputMode="decimal"
              step={0.1}
              min={0}
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              placeholder="Ex: 78.5"
            />
            {erroDoCampo('peso') && <div className="bf-error">{erroDoCampo('peso')}</div>}
          </div>

          <div className="bf-field">
            <label htmlFor="bf-altura">Altura (cm)</label>
            <input
              id="bf-altura"
              type="number"
              inputMode="decimal"
              step={0.1}
              min={0}
              value={altura}
              onChange={(e) => setAltura(e.target.value)}
              placeholder="Ex: 175"
            />
            {erroDoCampo('altura') && <div className="bf-error">{erroDoCampo('altura')}</div>}
          </div>

          <div className="bf-field bf-field--readonly">
            <label>IMC (calculado)</label>
            <div className="bf-readonly-value">{imc != null ? imc.toFixed(2) : '—'}</div>
          </div>

          <div className="bf-field">
            <label htmlFor="bf-gordura">% de gordura (aparelho)</label>
            <input
              id="bf-gordura"
              type="number"
              inputMode="decimal"
              step={0.1}
              min={0}
              value={percentualGordura}
              onChange={(e) => setPercentualGordura(e.target.value)}
              placeholder="Ex: 21.5"
            />
            {erroDoCampo('percentualGordura') && <div className="bf-error">{erroDoCampo('percentualGordura')}</div>}
          </div>

          <div className="bf-field">
            <div className="bf-field-header">
              <label htmlFor="bf-massa-gorda">Massa gorda (kg)</label>
              {massaGordaModo === 'manual' && (
                <button
                  type="button"
                  className="bf-reset-btn"
                  onClick={() => {
                    setMassaGordaModo('calculado');
                    setMassaGordaManual('');
                  }}
                >
                  ↺ usar calculado
                </button>
              )}
            </div>
            <input
              id="bf-massa-gorda"
              type="number"
              inputMode="decimal"
              step={0.01}
              min={0}
              value={massaGordaModo === 'manual' ? massaGordaManual : (massaGordaCalculada?.toFixed(2) ?? '')}
              onChange={(e) => handleEditarMassaGorda(e.target.value)}
              placeholder="Auto (peso × %gordura)"
            />
            {massaGordaModo === 'calculado' && <div className="bf-hint">Calculado — edite pra sobrescrever</div>}
            {erroDoCampo('massaGorda') && <div className="bf-error">{erroDoCampo('massaGorda')}</div>}
          </div>

          <div className="bf-field">
            <label htmlFor="bf-massa-magra-pct">% de massa magra (aparelho)</label>
            <input
              id="bf-massa-magra-pct"
              type="number"
              inputMode="decimal"
              step={0.1}
              min={0}
              value={percentualMassaMagra}
              onChange={(e) => setPercentualMassaMagra(e.target.value)}
              placeholder="Ex: 78.5"
            />
            {erroDoCampo('percentualMassaMagra') && (
              <div className="bf-error">{erroDoCampo('percentualMassaMagra')}</div>
            )}
          </div>

          <div className="bf-field">
            <div className="bf-field-header">
              <label htmlFor="bf-massa-magra">Massa magra (kg)</label>
              {massaMagraModo === 'manual' && (
                <button
                  type="button"
                  className="bf-reset-btn"
                  onClick={() => {
                    setMassaMagraModo('calculado');
                    setMassaMagraManual('');
                  }}
                >
                  ↺ usar calculado
                </button>
              )}
            </div>
            <input
              id="bf-massa-magra"
              type="number"
              inputMode="decimal"
              step={0.01}
              min={0}
              value={massaMagraModo === 'manual' ? massaMagraManual : (massaMagraCalculada?.toFixed(2) ?? '')}
              onChange={(e) => handleEditarMassaMagra(e.target.value)}
              placeholder="Auto (peso × %massa magra)"
            />
            {massaMagraModo === 'calculado' && <div className="bf-hint">Calculado — edite pra sobrescrever</div>}
            {erroDoCampo('massaMagra') && <div className="bf-error">{erroDoCampo('massaMagra')}</div>}
          </div>

          <div className="bf-field">
            <label htmlFor="bf-visceral">Gordura visceral (índice do aparelho)</label>
            <input
              id="bf-visceral"
              type="number"
              inputMode="decimal"
              step={1}
              min={0}
              value={gorduraVisceral}
              onChange={(e) => setGorduraVisceral(e.target.value)}
              placeholder="Ex: 8"
            />
            {erroDoCampo('gorduraVisceral') && <div className="bf-error">{erroDoCampo('gorduraVisceral')}</div>}
          </div>

          <div className="bf-field">
            <label htmlFor="bf-tmb">Taxa metabólica basal (kcal/dia)</label>
            <input
              id="bf-tmb"
              type="number"
              inputMode="decimal"
              step={1}
              min={0}
              value={metabolismoBasal}
              onChange={(e) => setMetabolismoBasal(e.target.value)}
              placeholder="Ex: 1750"
            />
            {erroDoCampo('metabolismoBasal') && <div className="bf-error">{erroDoCampo('metabolismoBasal')}</div>}
          </div>
        </div>

        {tentouRevisar && !podeRevisar && (
          <div className="bf-error bf-error-summary">Corrija os campos destacados para continuar.</div>
        )}

        <div className="bf-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleRevisar}>
            Revisar
          </button>
        </div>
      </div>
    </div>
  );
}
