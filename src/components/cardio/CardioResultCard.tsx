import type { CardioTestResult } from '../../types/cardioTest';

interface CardioResultCardProps {
  result: CardioTestResult;
}

/**
 * Sucessor de cardioRenderResult() (index.html ~9007-9035): valor de VO2,
 * badge de classificação, sub-stats de FC, nota da fórmula usada e a
 * tabela de zonas de Karvonen — mesmo layout, mesmas classes `cardio-*`.
 */
export function CardioResultCard({ result }: CardioResultCardProps) {
  return (
    <div className="card cardio-result-card">
      <div className="card-title">Capacidade Aeróbica Estimada</div>
      <div className="cardio-vo2-display">
        <div className="cardio-vo2-value">{result.vo2.toFixed(1)}</div>
        <div className="cardio-vo2-unit">ml/kg/min</div>
      </div>
      <div className={`cardio-level-badge ${result.classification.cls}`}>{result.classification.label}</div>

      <div className="cardio-sub-stats">
        <div className="cardio-sub-stat">
          <div className="cardio-sub-stat-label">FC Máxima</div>
          <div className="cardio-sub-stat-value">{result.fcMax} bpm</div>
        </div>
        <div className="cardio-sub-stat">
          <div className="cardio-sub-stat-label">FC de Reserva</div>
          <div className="cardio-sub-stat-value">{result.fcr} bpm</div>
        </div>
      </div>

      <p className="cardio-formula-note">
        <span className="cardio-formula-code">Fórmulas:</span> {result.formulaUsed}.
      </p>

      <table className="cardio-zones-table">
        <thead>
          <tr>
            <th>Zona</th>
            <th>% Esforço (FCR)</th>
            <th>Faixa de FC (bpm)</th>
          </tr>
        </thead>
        <tbody>
          {result.zones.map((z) => (
            <tr className="cardio-zone-row" key={z.key}>
              <td>
                <div className={`cardio-zone-bar ${z.cls}-bg`} style={{ width: `${Math.round(z.max * 100)}%` }} />
                <div className={`cardio-zone-name ${z.cls}`}>{z.name}</div>
                <div className="cardio-zone-desc">{z.desc}</div>
              </td>
              <td>
                <span className={`cardio-zone-pct ${z.cls}`}>
                  {Math.round(z.min * 100)}–{Math.round(z.max * 100)}%
                </span>
              </td>
              <td>
                <span className="cardio-zone-bpm">
                  {z.bpmMin} – {z.bpmMax}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
