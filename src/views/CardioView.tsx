import { useWorkoutStore } from '../store/useWorkoutStore';
import { useExerciseStore } from '../store/useExerciseStore';
import { getCardioWeekSummary } from '../utils/weekEngagement';
import { useWearableCardioWeek } from '../hooks/useWearableCardioWeek';
import { CardioGoalCard } from '../components/cardio/CardioGoalCard';
import { CardioSessionsCard } from '../components/cardio/CardioSessionsCard';
import { CardioTestPanel } from '../components/cardio/CardioTestPanel';
import { CardioHistoryCard } from '../components/cardio/CardioHistoryCard';
import '../components/cardio/CardioView.css';

/**
 * Conteúdo de Cardio sem o cabeçalho de página — reaproveitado tanto
 * pela view standalone (CardioView, abaixo) quanto pela sub-aba
 * "Cardiorrespiratório" de Performance (equivalente ao
 * `perf-cardio-content` do original).
 *
 * Integração wearable (Health Connect/Apple Health): useWearableCardioWeek
 * é chamado uma única vez aqui e repassado pra baixo, pra Meta Semanal e
 * Sessões usarem o mesmo cálculo (mesma sincronização em segundo plano,
 * mesma lista dedupada) em vez de cada card buscar por conta própria. Sem
 * wearable conectado, `wearable.sessions` fica vazio e nada muda na tela —
 * baseline 100% preservado pra quem usa só o registro manual.
 */
export function CardioContent() {
  const weekLog = useWorkoutStore((s) => s.weekLog);
  const exercises = useExerciseStore((s) => s.exercises);
  const summary = getCardioWeekSummary(weekLog, exercises);
  const wearable = useWearableCardioWeek();

  return (
    <>
      <CardioGoalCard summary={summary} wearableExtraMin={wearable.extraMinutes} />
      <CardioSessionsCard wearable={wearable} />
      <CardioTestPanel />
      <CardioHistoryCard />
    </>
  );
}

/**
 * Sucessor de #view-cardio (index.html ~3072-3256): junta o que já
 * existia no app (meta semanal + sessões, registradas no Registro do dia
 * via CardioLogEntry) com o módulo de Testes Cardiovasculares migrado do
 * HTML de referência (VO2 Máx via Bruce/Astrand/Storer + Cooper 12min
 * novo) e um histórico/comparação que também não existia no original.
 *
 * O grid mensal de consistência (#cgrid-card) do topo da view original
 * não entrou aqui — vive só em Performance (ver ConsistencyGridCard),
 * mesma decisão de escopo documentada quando este módulo foi construído.
 */
export function CardioView() {
  return (
    <div>
      <div className="sec-row">
        <div className="page-title">
          Cardio &amp; VO2 Máx <span className="tag">CAPACIDADE AERÓBICA</span>
        </div>
      </div>
      <CardioContent />
    </div>
  );
}
