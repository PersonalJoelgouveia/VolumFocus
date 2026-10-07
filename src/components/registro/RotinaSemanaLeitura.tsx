import { DAYS, GROUP_LABELS } from '../../types/workout';
import { isAlunoExercicioCardio } from '../../types/aluno';
import type { AlunoExercicio, AlunoRotina, AlunoRotinaDia } from '../../types/aluno';
import '../clientes/ClientesView.css';

/**
 * Prescrição semanal COMPLETA em MODO LEITURA: os 7 dias empilhados, cada um com
 * seus exercícios na ordem prescrita. Usa as mesmas classes `cli-*` de
 * AlunoDetailModal/MinhaRotinaView. Puramente visual: não lê nem escreve em
 * nenhum store de treino.
 *
 * O schema da rotina (`AlunoExercicio`) não tem campos próprios de descanso ou
 * método: quando o Personal os registrou, estão em `notes` (exibido) e em
 * `groupType` (Bi-Set/Tri-Set/Superset/Circuito, exibido como chip).
 */
export function RotinaSemanaLeitura({ rotina }: { rotina: AlunoRotina }) {
  return (
    <div className="mrs-semana">
      {DAYS.map((nomeDia, d) => (
        <DiaLeitura key={nomeDia} nomeDia={nomeDia} dia={rotina[d]} />
      ))}
    </div>
  );
}

function DiaLeitura({ nomeDia, dia }: { nomeDia: string; dia: AlunoRotinaDia | undefined }) {
  const exercicios = dia?.exercicios ?? [];
  return (
    <section className={`mrs-dia${exercicios.length === 0 ? ' mrs-dia-descanso' : ''}`}>
      <div className="cli-day-type" style={{ marginBottom: exercicios.length ? 10 : 0 }}>
        {nomeDia} — {dia?.tipo ?? 'Descanso Total'}
        {exercicios.length > 0 && (
          <span className="mrs-dia-count">
            {' '}
            · {exercicios.length} ex.
          </span>
        )}
      </div>

      {exercicios.length === 0 ? (
        <div className="mrs-descanso">💤 Dia de descanso — nenhum exercício programado.</div>
      ) : (
        <ListaExerciciosLeitura exercicios={exercicios} />
      )}
    </section>
  );
}

/** Lista de exercícios em leitura (ordem prescrita, séries×reps, carga, método e observação). */
export function ListaExerciciosLeitura({ exercicios }: { exercicios: AlunoExercicio[] }) {
  return (
    <div className="cli-ex-list">
      {exercicios.map((ex, i) => (
        <div className="cli-ex-item" key={i}>
          <div className="cli-ex-info">
            <div className="cli-ex-name" title={ex.nome}>
              <span className="mrs-ord">{i + 1}.</span> {ex.nome}
            </div>
            <div className="cli-ex-detail">
              {isAlunoExercicioCardio(ex) ? (
                <>
                  <span className="cli-ex-chip">{ex.duracao}</span>
                  <span className="cli-ex-chip">Intensidade: {ex.intensidade}</span>
                </>
              ) : (
                <>
                  <span className="cli-ex-chip">
                    {ex.series}×{ex.reps}
                  </span>
                  <span className="cli-ex-chip">{ex.carga}kg</span>
                  {ex.rir != null && <span className="cli-ex-chip">RIR {ex.rir}</span>}
                  {ex.sugestao && <span className="cli-ex-chip cli-ex-chip-sug">▲ {ex.sugestao}kg</span>}
                </>
              )}
              {ex.groupType && <span className="cli-ex-chip cli-ex-chip-sug">{GROUP_LABELS[ex.groupType]}</span>}
            </div>
            {ex.notes && (
              <div style={{ fontSize: '0.65rem', color: 'var(--teal)', marginTop: 6, fontStyle: 'italic' }}>
                # {ex.notes}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
