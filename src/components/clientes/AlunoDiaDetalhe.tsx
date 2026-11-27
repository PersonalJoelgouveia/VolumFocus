import { isCardioLogEntry } from '../../types/workout';
import type { WorkoutLogEntry } from '../../types/workout';
import type { ExercicioResumo, SemanaDoc } from '../../utils/performanceSync';

function resumo(e: WorkoutLogEntry): string {
  if (isCardioLogEntry(e)) {
    const extra = [e.distance ? `${e.distance} km` : '', e.avgHr ? `${e.avgHr} bpm` : ''].filter(Boolean).join(' · ');
    return `${e.duration || 0} min · PSE ${e.intensity ?? '-'}/10${extra ? ` · ${extra}` : ''}`;
  }
  const cargas = Array.isArray(e.serieLoads) && e.serieLoads.length ? e.serieLoads : null;
  const reps = Array.isArray(e.serieReps) && e.serieReps.length ? e.serieReps : null;
  const sets = e.sets || cargas?.length || 0;
  const cargaTxt = cargas ? cargas.join('/') : `${e.load ?? 0}`;
  const repsTxt = reps ? reps.join('/') : `${e.reps ?? 0}`;
  return `${sets}× ${repsTxt} reps · ${cargaTxt} kg`;
}

/**
 * Treino de UM dia do aluno (somente leitura), para o Personal. Vem do documento da semana publicado pelo
 * app do aluno. Semanas arquivadas não têm marcação granular: tudo conta como feito.
 */
export function AlunoDiaDetalhe({
  semana,
  dia,
  rotulo,
  exercicios,
}: {
  semana: SemanaDoc | undefined;
  dia: number;
  rotulo: string;
  exercicios: ExercicioResumo[];
}) {
  const log = semana?.weekLog[dia] ?? [];
  const pse = semana?.weekPSE[String(dia)];
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="card-title">📅 Treino de {rotulo}</div>
      {log.length === 0 ? (
        <div className="cardio-empty">Nenhum treino registrado neste dia.</div>
      ) : (
        <div className="cardio-hist-list">
          {log.map((e, i) => {
            const ex = exercicios.find((x) => x.id === e.exId);
            const feito = semana?.exDone ? !!semana.exDone[`${dia}:${i}` as never] : true;
            return (
              <div className="cardio-hist-item" key={i}>
                <div className="cardio-hist-item-left">
                  <span className="cardio-hist-vo2" style={{ fontSize: '0.8rem' }} aria-label={feito ? 'concluído' : 'não concluído'}>
                    {feito ? '✓' : '○'}
                  </span>
                  <div>
                    <div>{ex?.name ?? 'Exercício removido'}</div>
                    <div className="cardio-hist-date">{resumo(e)}</div>
                    {e.notes && <div className="cardio-hist-date"># {e.notes}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {typeof pse === 'number' && <div className="cardio-hist-date" style={{ marginTop: 8 }}>PSE do dia: {pse}/10</div>}
      {semana && (
        <div className="cardio-hist-date" style={{ marginTop: 4 }}>
          Atualizado em {new Date(semana.atualizadoEm).toLocaleString('pt-BR')}
        </div>
      )}
    </div>
  );
}
