import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { useRetroWeeksStore } from '../../store/useRetroWeeksStore';
import { useUIStore } from '../../store/useUIStore';
import { isCurrentWeek, weekAndDayOf } from '../../utils/retroWeek';
import type { DayIndex } from '../../types/workout';
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

  const retro = useRetroWeeksStore((s) => s.weeks);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const [offset, setOffset] = useState(0);

  const data = buildCgridData(weekLog, exDone, historico, exercises, retro, offset);

  /** Dia passado/hoje: abre a semana dele em Meus Treinos (atual) ou no lançamento retroativo (passada). */
  function abrirDia(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const { key, day } = weekAndDayOf(new Date(y, m - 1, d));
    if (isCurrentWeek(key)) {
      useWorkoutStore.getState().selectDay(day as DayIndex);
      setActiveView('registro');
      return;
    }
    useRetroWeeksStore.getState().open(key, day as DayIndex);
    setActiveView('retro');
  }

  return (
    <div className="card cgrid-section cgrid-compact" style={{ marginBottom: 16 }}>
      <div className="cgrid-header">
        <div className="cgrid-title">🗓️ Consistência do Mês</div>
        <div className="cgrid-month-nav">
          <button type="button" className="cgrid-nav-btn" aria-label="Mês anterior" onClick={() => setOffset((o) => o - 1)}>
            <ChevronLeft size={16} />
          </button>
          <div className="cgrid-month-label">{data.monthLabel}</div>
          <button type="button" className="cgrid-nav-btn" aria-label="Próximo mês" disabled={offset >= 0} onClick={() => setOffset((o) => Math.min(0, o + 1))}>
            <ChevronRight size={16} />
          </button>
        </div>
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
            className={`cgrid-cell ${c.state}${c.isToday ? ' cgrid-hoje' : ''}${c.isFuture ? ' cgrid-futuro' : ' cgrid-click'}`}
            title={c.isFuture ? `${c.day}` : `${c.day} — abrir/lançar treino deste dia`}
            role={c.isFuture ? undefined : 'button'}
            tabIndex={c.isFuture ? undefined : 0}
            aria-label={c.isFuture ? undefined : `Abrir treino do dia ${c.day}`}
            onClick={c.isFuture ? undefined : () => abrirDia(c.date)}
            onKeyDown={
              c.isFuture
                ? undefined
                : (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      abrirDia(c.date);
                    }
                  }
            }
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
