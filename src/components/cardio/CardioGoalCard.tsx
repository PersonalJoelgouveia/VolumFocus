import { useState } from 'react';
import { useCardioGoalStore } from '../../store/useCardioGoalStore';
import type { CardioWeekSummary } from '../../types/history';

interface CardioGoalCardProps {
  summary: CardioWeekSummary;
}

/**
 * Bloco 1: Meta Semanal — não existe no HTML de referência (que só tinha
 * um número fixo de 90min usado dentro de renderNovaSemana). Meta agora é
 * configurável via useCardioGoalStore (mesma store que a NovaSemanaView
 * lê, para não ter dois números "meta semanal" divergentes no app).
 */
export function CardioGoalCard({ summary }: CardioGoalCardProps) {
  const metaMin = useCardioGoalStore((s) => s.metaMin);
  const setMetaMin = useCardioGoalStore((s) => s.setMetaMin);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(metaMin));

  const pct = metaMin > 0 ? Math.min(100, (summary.totalMin / metaMin) * 100) : 0;
  const restantes = Math.max(0, metaMin - summary.totalMin);
  const done = summary.totalMin >= metaMin;

  function salvarMeta() {
    const val = parseInt(draft, 10);
    if (!isNaN(val) && val > 0) setMetaMin(val);
    setEditing(false);
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">🎯 Meta Semanal</div>

      <div className="cardio-goal-row">
        {editing ? (
          <div className="cardio-goal-edit">
            <input
              type="number"
              min={0}
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && salvarMeta()}
              onBlur={salvarMeta}
            />
            <span className="cardio-goal-of">min/semana</span>
          </div>
        ) : (
          <div>
            <span className="cardio-goal-value">{summary.totalMin}</span>
            <span className="cardio-goal-of"> / {metaMin} min</span>
          </div>
        )}
        {!editing && (
          <button
            className="btn btn-ghost btn-icon btn-sm"
            title="Editar meta"
            onClick={() => {
              setDraft(String(metaMin));
              setEditing(true);
            }}
          >
            ✏️
          </button>
        )}
      </div>

      <div className="cardio-progress-track">
        <div
          className={`cardio-progress-fill${done ? ' cardio-progress-done' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="cardio-goal-stats">
        <div className="cardio-sub-stat">
          <div className="cardio-sub-stat-label">Progresso</div>
          <div className="cardio-sub-stat-value">{pct.toFixed(0)}%</div>
        </div>
        <div className="cardio-sub-stat">
          <div className="cardio-sub-stat-label">{done ? 'Meta batida' : 'Restam'}</div>
          <div className="cardio-sub-stat-value">{done ? '✅' : `${restantes} min`}</div>
        </div>
      </div>
    </div>
  );
}
