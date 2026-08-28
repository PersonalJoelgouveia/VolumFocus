import { useWorkoutStore } from '../store/useWorkoutStore';
import { useExerciseStore } from '../store/useExerciseStore';
import { getCardioWeekSummary } from '../utils/weekEngagement';
import { CardioGoalCard } from '../components/cardio/CardioGoalCard';
import { CardioSessionsCard } from '../components/cardio/CardioSessionsCard';
import { CardioTestPanel } from '../components/cardio/CardioTestPanel';
import { CardioHistoryCard } from '../components/cardio/CardioHistoryCard';
import '../components/cardio/CardioView.css';

/**
 * Sucessor de #view-cardio (index.html ~3072-3256): junta o que já
 * existia no app (meta semanal + sessões, registradas no Registro do dia
 * via CardioLogEntry) com o módulo de Testes Cardiovasculares migrado do
 * HTML de referência (VO2 Máx via Bruce/Astrand/Storer + Cooper 12min
 * novo) e um histórico/comparação que também não existia no original.
 *
 * O grid mensal de consistência (#cgrid-card) do topo da view original
 * não entrou aqui — é compartilhado com Força (força+cardio no mesmo
 * calendário) e faz mais sentido junto do Dashboard/Performance, quando
 * essas frentes forem portadas.
 */
export function CardioView() {
  const weekLog = useWorkoutStore((s) => s.weekLog);
  const exercises = useExerciseStore((s) => s.exercises);
  const summary = getCardioWeekSummary(weekLog, exercises);

  return (
    <div>
      <div className="sec-row">
        <div className="page-title">
          Cardio &amp; VO2 Máx <span className="tag">CAPACIDADE AERÓBICA</span>
        </div>
      </div>

      <CardioGoalCard summary={summary} />
      <CardioSessionsCard />
      <CardioTestPanel />
      <CardioHistoryCard />
    </div>
  );
}
