import { ZONES } from '../../utils/strengthCalc';

interface StrZonesCardProps {
  oneRM: number | null;
}

/** Sucessor do CARD de zonas percentuais + strRenderZones() (index.html ~3047-3064, ~9319-9336). */
export function StrZonesCard({ oneRM }: StrZonesCardProps) {
  return (
    <div className="card str-zones-card">
      <div className="card-title">Zonas de Alvo Percentuais para Prescrição de Carga</div>

      {!oneRM ? (
        <div style={{ padding: 18, textAlign: 'center', color: 'var(--text-3)', fontSize: '0.8rem' }}>
          Calcule um 1RM acima para ver as prescrições de carga por zona. 🎯
        </div>
      ) : (
        <table className="str-zones-table">
          <thead>
            <tr>
              <th>Zona de Objetivo</th>
              <th>Intensidade</th>
              <th>Carga Alvo</th>
              <th>Repetições</th>
            </tr>
          </thead>
          <tbody>
            {ZONES.map((z) => (
              <tr key={z.name}>
                <td>
                  <span className={`str-zone-tag ${z.cssClass}`}>{z.name}</span>
                </td>
                <td>
                  <span className="str-pct-badge">{Math.round(z.pct * 100)}%</span>
                </td>
                <td className="str-zone-load">{Math.round(oneRM * z.pct)} kg</td>
                <td className="str-zone-reps">{z.reps} rps</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
