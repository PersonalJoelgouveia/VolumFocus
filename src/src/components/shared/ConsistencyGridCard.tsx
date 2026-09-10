import { useWorkoutStore } from '../../store/useWorkoutStore';
import { useExerciseStore } from '../../store/useExerciseStore';
import { useHistoricoStore } from '../../store/useHistoricoStore';
import { buildCgridData } from '../../utils/consistencyGrid';
import './ConsistencyGridCard.css';

/**
 * Sucessor de #cgrid-card + cgrid.render() (index.html ~2811-2834,
 * ~8620-8680): heatmap de consistência do mês (Força/Cardio/Ambos),
 * legenda e stats row. Único no app — vive só no topo de Performance
 * (mesma posição de #cgrid-card-perf no original, que era a cópia
 * "principal" quando incorporado às sub-abas).
 */
export function ConsistencyGridCard() {
  const weekLog = useWorkoutStore((s) => s.weekLog);
  const exDone = useWorkoutStore((s) => s.exDone);
  const exercises = useExerciseStore((s) => s.exercises);
  const historico = useHistoricoStore((s) => s.semanas);

  const data = buildCgridData(weekLog, exDone, historico, exercises);

  return (
    <div className="card cgrid-section cgrid-compact" style={{ marginBottom: 16 }}>
      <div className="cgrid-header">
        <div className="cgrid-title">🗓️ Consistência do Mês</div>
        <div className="cgrid-month-label">{data.monthLabel}</div>
      </div>
      <div className="cgrid-legend">
        <div className="cgrid-legend-item">
          <div className="cgrid-legend-dot cgrid-dot-forca" />
          Força
        </div>
        <div className="cgrid-legend-item">
          <div className="cgrid-legend-dot cgrid-dot-cardio" />
          Cardio
        </div>
        <div className="cgrid-legend-item">
          <div className="cgrid-legend-dot cgrid-dot-ambos" />
          Ambos
        </div>
        <div className="cgrid-legend-item">
          <div className="cgrid-legend-dot cgrid-dot-vazio" />
          Repouso
        </div>
      </div>
      <div className="cgrid-dow-row">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((l) => (
          <div className="cgrid-dow-label" key={l}>
            {l}
          </div>
        ))}
      </div>
      <div className="cgrid-grid">
        {Array.from({ length: data.leadingEmpty }).map((_, i) => (
          <div className="cgrid-cell cgrid-empty" key={`empty-${i}`} />
        ))}
        {data.cells.map((c) => (
          <div
            key={c.day}
            className={`cgrid-cell ${c.state}${c.isToday ? ' cgrid-hoje' : ''}${c.isFuture ? ' cgrid-futuro' : ''}`}
            title={`${c.day}`}
          >
            <span className="cgrid-day-num">{c.day}</span>
          </div>
        ))}
      </div>
      {/* .cgrid-stat/.cgrid-stats-row já definidas em components/conquistas/ConquistasView.css
          (mesmo padrão de "stat pill" reaproveitado ali) — não duplicado aqui. */}
      <div className="cgrid-stats-row">
        <div className="cgrid-stat">
          <div className="cgrid-stat-val">{data.totalForca}</div>
          <div className="cgrid-stat-lbl">💪 Força</div>
        </div>
        <div className="cgrid-stat">
          <div className="cgrid-stat-val">{data.totalCardio}</div>
          <div className="cgrid-stat-lbl">❤️ Cardio</div>
        </div>
        <div className="cgrid-stat">
          <div className="cgrid-stat-val">{data.totalAmbos}</div>
          <div className="cgrid-stat-lbl">⚡ Ambos</div>
        </div>
        <div className="cgrid-stat">
          <div className="cgrid-stat-val" style={{ color: 'var(--orange)' }}>
            {data.pctDoMes}%
          </div>
          <div className="cgrid-stat-lbl">🗓️ do Mês</div>
        </div>
      </div>
    </div>
  );
}
