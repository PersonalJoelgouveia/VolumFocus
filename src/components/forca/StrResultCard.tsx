import { STR_FORMULAS, STR_FORMULA_ORDER, getLevel } from '../../utils/strengthCalc';
import type { StrCalcOutcome } from './StrCalcCard';

interface StrResultCardProps {
  result: StrCalcOutcome | null;
}

/**
 * Sucessor do CARD 2 (Resultado 1RM) + strRenderResult() (index.html
 * ~3012-3032, ~9271-9318): valor, badge de nível, nota de RIR (se
 * aplicável) e o comparativo entre as 4 fórmulas.
 */
export function StrResultCard({ result }: StrResultCardProps) {
  if (!result) {
    return (
      <div className="card str-result-card">
        <div className="card-title">Capacidade de Força Absoluta</div>
        <div className="str-1rm-display">
          <div className="str-1rm-value">—</div>
          <div className="str-1rm-unit">kg (1RM)</div>
        </div>
        <div className="str-level-badge str-badge-iniciante">Aguardando cálculo</div>
        <p className="str-formula-note">Selecione o exercício, insira carga e repetições e escolha a fórmula desejada.</p>
      </div>
    );
  }

  const level = getLevel(result.oneRM);
  const repsEfetivas = result.reps + result.rir;

  return (
    <div className="card str-result-card">
      <div className="card-title">Capacidade de Força Absoluta</div>
      <div className="str-1rm-display">
        <div className="str-1rm-value">{result.oneRM.toFixed(1)}</div>
        <div className="str-1rm-unit">kg (1RM)</div>
      </div>
      <div className="str-formula-label">{STR_FORMULAS[result.formula].label}</div>
      <div className={`str-level-badge ${level.cssClass}`}>{level.label}</div>

      {result.rir > 0 && (
        <div className="str-rir-result">
          RIR {result.rir} aplicado — repetições efetivas: {repsEfetivas} (não {result.reps})
        </div>
      )}

      <p className="str-formula-note">
        Calculado com <span className="str-formula-code">{STR_FORMULAS[result.formula].desc}</span> a partir de{' '}
        {result.weight}kg × {repsEfetivas} reps efetivas.
        {result.isNewRecord && ' 🏆 Novo recorde pessoal!'}
      </p>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
          Comparativo de Fórmulas
        </div>
        {STR_FORMULA_ORDER.map((k) => {
          const val = result.all[k];
          return (
            <div className={`str-formula-compare-item${k === result.formula ? ' active-formula' : ''}`} key={k}>
              <span className="str-formula-compare-name">{STR_FORMULAS[k].label}</span>
              <span className="str-formula-compare-val">{val != null ? `${val.toFixed(1)} kg` : '—'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
