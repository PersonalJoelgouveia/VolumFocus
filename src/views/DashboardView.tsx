import { useEffect, useState } from 'react';
import { useUIStore } from '../store/useUIStore';
import { useExerciseStore } from '../store/useExerciseStore';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { LEVEL_GOALS, LOWER, UPPER, VOL_MAX_LOWER, VOL_MAX_UPPER, COMPARISONS } from '../data/dashboardData';
import type { TrainingLevel, WeekLog } from '../types/workout';
import type { Exercise } from '../types/exercise';
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
export function XRayContent({ weekLog: weekLogProp, exercises: exercisesProp }: { weekLog?: WeekLog; exercises?: Exercise[] } = {}) {
  const exercisesLocal = useExerciseStore((s) => s.exercises);
  const weekLogLocal = useWorkoutStore((s) => s.weekLog);
  // Personal vendo um aluno passa a semana/exercícios DELE; sem props usa os do próprio usuário.
  const exercises = exercisesProp ?? exercisesLocal;
  const weekLog = weekLogProp ?? weekLogLocal;
  const levelStore = useWorkoutStore((s) => s.selectedLevel);
  const setLevelStore = useWorkoutStore((s) => s.setLevel);
  // Vendo um aluno: o nível é só local (não altera o nível salvo do próprio Personal).
  const [levelLocal, setLevelLocal] = useState<TrainingLevel>(levelStore);
  const selectedLevel = weekLogProp ? levelLocal : levelStore;
  const setLevel = weekLogProp ? setLevelLocal : setLevelStore;

  const weekVol = calcWeekVolume(weekLog, exercises);
  const { kg, reps, sets } = calcWeekTonnage(weekLog);
  const comparison = [...COMPARISONS].reverse().find((c) => kg >= c.th) ?? null;
  const lv = LEVEL_GOALS[selectedLevel];

  return (
    <div>
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
        {!weekLogProp && <CalorieCard />}
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

/**
 * X-ray deixou de ser item independente da sidebar: agora é uma seção ao
 * final de Performance (ver PerformanceView). Este ViewId permanece só como
 * redirecionamento, para não quebrar atalhos antigos.
 */
export function DashboardView() {
  const setActiveView = useUIStore((s) => s.setActiveView);
  useEffect(() => {
    setActiveView('performance');
  }, [setActiveView]);
  return null;
}
