import { useWorkoutStore } from '../../store/useWorkoutStore';
import { useExerciseStore } from '../../store/useExerciseStore';
import { DAYS_SHORT, isCardioLogEntry } from '../../types/workout';
import type { WearableCardioWeek } from '../../hooks/useWearableCardioWeek';

interface CardioSessionsCardProps {
  /** Sessões wearable da semana já combinadas/dedupadas (useWearableCardioWeek),
   *  calculadas uma única vez em CardioContent e repassadas aqui — evita
   *  disparar sync/leitura duplicada se este card e a meta precisassem do
   *  mesmo dado. */
  wearable: WearableCardioWeek;
}

/**
 * Bloco 2: Sessões de Cardio — lista as CardioLogEntry já registradas na
 * semana atual (mesmo registro usado no Registro do dia / RegistroView;
 * nenhuma estrutura nova) MESCLADAS com as sessões automáticas do wearable
 * conectado (Health Connect/Apple Health), quando houver. Cada fonte é
 * marcada com um selo "✍️ Manual" ou "⌚ Auto" — sessões wearable que batem
 * com um registro manual do mesmo dia (mesma duração, dentro de tolerância)
 * são tratadas como a mesma atividade e ficam fora da lista, pra não contar
 * nem exibir a mesma sessão 2x (ver markDuplicates em utils/wearableCardio).
 */
export function CardioSessionsCard({ wearable }: CardioSessionsCardProps) {
  const weekLog = useWorkoutStore((s) => s.weekLog);
  const exercises = useExerciseStore((s) => s.exercises);

  const manualSessions: { day: number; name: string; duration: number; intensity: number }[] = [];
  for (let d = 0; d < 7; d++) {
    for (const e of weekLog[d] ?? []) {
      if (!isCardioLogEntry(e)) continue;
      const ex = exercises.find((x) => x.id === e.exId);
      manualSessions.push({ day: d, name: ex ? ex.name : 'Cardio', duration: e.duration || 0, intensity: e.intensity || 0 });
    }
  }

  const wearableSessions = wearable.sessions.filter((s) => !s.isDuplicate);
  const duplicateCount = wearable.sessions.length - wearableSessions.length;
  const isEmpty = manualSessions.length === 0 && wearableSessions.length === 0;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">🏃 Sessões de Cardio · Esta Semana</div>

      {isEmpty ? (
        <div className="cardio-empty">
          Nenhuma sessão registrada ainda. Registre um exercício cardio no dia de treino ou conecte um wearable para ele aparecer aqui.
        </div>
      ) : (
        <>
          <div className="cardio-session-list">
            {manualSessions.map((s, i) => (
              <div className="cardio-session-item" key={`m-${i}`}>
                <span className="cardio-session-day">{DAYS_SHORT[s.day]}</span>
                <div className="cardio-session-info">
                  <div className="cardio-session-name">
                    <span className="cardio-session-name-text">{s.name}</span>
                    <span className="cardio-source-badge cardio-source-manual">✍️ Manual</span>
                  </div>
                  <div className="cardio-session-meta">
                    {s.duration} min · Intensidade {s.intensity}/10
                  </div>
                </div>
              </div>
            ))}

            {wearableSessions.map((s) => (
              <div className="cardio-session-item cardio-session-item-auto" key={`w-${s.id}`}>
                <span className="cardio-session-day">{DAYS_SHORT[s.dayIndex]}</span>
                <div className="cardio-session-info">
                  <div className="cardio-session-name">
                    <span className="cardio-session-name-text">{s.label}</span>
                    <span className="cardio-source-badge cardio-source-auto">⌚ Auto</span>
                  </div>
                  <div className="cardio-session-meta">
                    {s.durationMin} min
                    {s.avgHr != null && ` · FC média ${s.avgHr} bpm`}
                    {s.maxHr != null && ` · máx ${s.maxHr}`}
                    {s.calories != null && ` · ${Math.round(s.calories)} kcal`}
                  </div>
                  {s.zoneTimes && (
                    <div className="cardio-zone-mini" title="Tempo em cada zona de FC durante a sessão">
                      {s.zoneTimes
                        .filter((z) => z.minutes > 0)
                        .map((z) => (
                          <span key={z.key} className={`cardio-zone-mini-chip ${z.cls}`}>
                            {z.name.split(' ')[0]} {z.minutes}min
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {duplicateCount > 0 && (
            <div className="cardio-wearable-note">
              ⌚ {duplicateCount} sessão{duplicateCount > 1 ? 'ões' : ''} do wearable já coincide{duplicateCount > 1 ? 'm' : ''} com um registro manual — não contada{duplicateCount > 1 ? 's' : ''} 2x.
            </div>
          )}
        </>
      )}
    </div>
  );
}
