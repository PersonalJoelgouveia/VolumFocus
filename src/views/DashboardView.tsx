import { useExerciseStore } from '../store/useExerciseStore';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { LEVEL_GOALS, LOWER, UPPER, VOL_MAX_LOWER, VOL_MAX_UPPER, COMPARISONS } from '../data/dashboardData';
import type { TrainingLevel } from '../types/workout';
import { calcWeekTonnage, calcWeekVolume } from '../utils/volumeCalc';
import { MetricCard } from '../components/dashboard/MetricCard';
import { CalorieCard } from '../components/dashboard/CalorieCard';
import { VolumeBar } from '../components/dashboard/VolumeBar';
import { MuscleBalanceCard } from '../components/dashboard/MuscleBalanceCard';
import '../components/dashboard/MetricCard.css';
import '../components/dashboard/VolumeBar.css';
import '../components/dashboard/MuscleBalanceCard.css';

/**
 * View "X-ray" (Dashboard) — sucessora de renderDashboard() (index.html ~4686).
 * Balanço Agonista/Antagonista migrado na Fase 4 (ver MuscleBalanceCard).
 * O bloco de Top 1RM segue pendente para uma próxima iteração — fora do
 * escopo explícito desta fase (sobrecarga progressiva + balanço + toasts).
 */
export function DashboardView() {
  const exercises = useExerciseStore((s) => s.exercises);
  const weekLog = useWorkoutStore((s) => s.weekLog);
  const selectedLevel = useWorkoutStore((s) => s.selectedLevel);
  const setLevel = useWorkoutStore((s) => s.setLevel);

  const weekVol = calcWeekVolume(weekLog, exercises);
  const { kg, reps, sets } = calcWeekTonnage(weekLog);
  const comparison = [...COMPARISONS].reverse().find((c) => kg >= c.th) ?? null;
  const lv = LEVEL_GOALS[selectedLevel];

  return (
    <div>
      <div className="sec-row">
        <div className="page-title">
          Dashboard <span className="tag">SEMANA</span>
        </div>
      </div>

      <div className="level-pill">
        {(Object.entries(LEVEL_GOALS) as [TrainingLevel, typeof lv][]).map(([key, goal]) => (
          <button
            key={key}
            className={`lv-btn${selectedLevel === key ? ' active' : ''}`}
            onClick={() => setLevel(key)}
          >
            <span className="lv-ico">{goal.icon}</span>
            {goal.label}
            <span className="lv-rng">
              {goal.min}–{goal.max} séries
            </span>
          </button>
        ))}
      </div>

      <div className="grid-auto" style={{ marginBottom: 24 }}>
        <MetricCard
          icon="🏋️"
          label="Tonelagem Semanal"
          value={(kg / 1000).toFixed(2)}
          unit="toneladas movidas"
          footer={
            comparison && (
              <div className="cq-compare">
                {comparison.emoji} Equivalente a <strong>{comparison.text}</strong>
              </div>
            )
          }
        />
        <MetricCard icon="🔁" label="Total de Séries" value={sets} unit="séries executadas" />
        <MetricCard icon="📊" label="Total de Reps" value={reps} unit="repetições no ciclo" />
        <CalorieCard />
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-title">Volume Superior</div>
          {UPPER.map((m) => (
            <VolumeBar
              key={m}
              muscle={m}
              value={weekVol[m] || 0}
              maxForFill={VOL_MAX_UPPER}
              min={lv.min}
              max={lv.max}
            />
          ))}
        </div>
        <div className="card">
          <div className="card-title">Volume Inferior</div>
          {LOWER.map((m) => (
            <VolumeBar
              key={m}
              muscle={m}
              value={weekVol[m] || 0}
              maxForFill={VOL_MAX_LOWER}
              min={lv.min}
              max={lv.max}
            />
          ))}
        </div>
      </div>

      <MuscleBalanceCard weekVol={weekVol} />
    </div>
  );
}
