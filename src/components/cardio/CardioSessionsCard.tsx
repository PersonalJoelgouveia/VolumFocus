import { useWorkoutStore } from '../../store/useWorkoutStore';
import { useExerciseStore } from '../../store/useExerciseStore';
import { DAYS_SHORT, isCardioLogEntry } from '../../types/workout';

/**
 * Bloco 2: Sessões de Cardio — lista as CardioLogEntry já registradas na
 * semana atual (mesmo registro usado no Registro do dia / RegistroView;
 * nenhuma estrutura nova). Cada sessão soma pra meta semanal do bloco 1.
 */
export function CardioSessionsCard() {
  const weekLog = useWorkoutStore((s) => s.weekLog);
  const exercises = useExerciseStore((s) => s.exercises);

  const sessions: { day: number; name: string; duration: number; intensity: number }[] = [];
  for (let d = 0; d < 7; d++) {
    for (const e of weekLog[d] ?? []) {
      if (!isCardioLogEntry(e)) continue;
      const ex = exercises.find((x) => x.id === e.exId);
      sessions.push({ day: d, name: ex ? ex.name : 'Cardio', duration: e.duration || 0, intensity: e.intensity || 0 });
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">🏃 Sessões de Cardio · Esta Semana</div>

      {sessions.length === 0 ? (
        <div className="cardio-empty">
          Nenhuma sessão registrada ainda. Registre um exercício cardio no dia de treino para ele aparecer aqui.
        </div>
      ) : (
        <div className="cardio-session-list">
          {sessions.map((s, i) => (
            <div className="cardio-session-item" key={i}>
              <span className="cardio-session-day">{DAYS_SHORT[s.day]}</span>
              <div className="cardio-session-info">
                <div className="cardio-session-name">{s.name}</div>
                <div className="cardio-session-meta">
                  {s.duration} min · Intensidade {s.intensity}/10
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
