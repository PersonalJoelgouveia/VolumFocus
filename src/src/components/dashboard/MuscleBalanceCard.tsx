import type { VolumeByMuscle } from '../../utils/volumeCalc';
import { PAIRS } from '../../data/dashboardData';
import './MuscleBalanceCard.css';

interface MuscleBalanceCardProps {
  weekVol: VolumeByMuscle;
}

/**
 * Card "Volume Agonista/Antagonista" — sucessor fiel do bloco
 * `PAIRS.forEach(...)` em renderDashboard() (index.html ~4764-4778),
 * incluindo o alerta textual com a razão atual vs. faixa de referência.
 */
export function MuscleBalanceCard({ weekVol }: MuscleBalanceCardProps) {
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-title">Volume Agonista/Antagonista</div>
      {PAIRS.map((p) => {
        const agV = p.ag.muscles.reduce((s, m) => s + (weekVol[m] || 0), 0);
        const antV = p.ant.muscles.reduce((s, m) => s + (weekVol[m] || 0), 0);
        const total = agV + antV || 1;
        const ratio = antV > 0 ? agV / antV : null;
        const ratioStr = ratio ? `${ratio.toFixed(2)}:1` : 'N/A';

        return (
          <div key={p.label}>
            <div className="bal-alert ok">
              <span>ℹ️</span>
              <div>
                <strong>{p.label}</strong>
                <br />
                {ratio
                  ? `Razão atual de volume: ${ratioStr} (faixa de referência ${p.safe[0]}–${p.safe[1]}). ${p.tip}`
                  : 'Sem dados suficientes para calcular ainda.'}
              </div>
            </div>

            <div className="bal-wrap">
              <div className="bal-name" style={{ color: p.ag.color }}>
                {p.ag.muscles[0]}
              </div>
              <div className="bal-track">
                <div
                  className="bal-fill"
                  style={{ width: `${Math.round((agV / total) * 100)}%`, background: p.ag.color }}
                />
              </div>
              <div className="bal-count">{agV.toFixed(0)}</div>
            </div>

            <div className="bal-wrap">
              <div className="bal-name" style={{ color: p.ant.color }}>
                {p.ant.muscles[0]}
              </div>
              <div className="bal-track">
                <div
                  className="bal-fill"
                  style={{ width: `${Math.round((antV / total) * 100)}%`, background: p.ant.color }}
                />
              </div>
              <div className="bal-count">{antV.toFixed(0)}</div>
            </div>

            <div className="bal-ratio">
              <span>Razão Ag:Ant</span>
              <span>{ratioStr}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
