import { useState } from 'react';
import { DAYS, DAYS_SHORT } from '../../types/workout';
import { isAlunoExercicioCardio } from '../../types/aluno';
import type { AlunoRotina } from '../../types/aluno';
import '../clientes/ClientesView.css';

/**
 * Prescrição semanal em MODO LEITURA (barra de dias + lista de exercícios), com
 * as mesmas classes `cli-*` de AlunoDetailModal/MinhaRotinaView. Puramente
 * visual: não lê nem escreve em nenhum store de treino.
 */
export function RotinaSemanaLeitura({ rotina }: { rotina: AlunoRotina }) {
  const [activeDay, setActiveDay] = useState(() => {
    const primeiro = rotina.findIndex((d) => d.exercicios.length > 0);
    return primeiro >= 0 ? primeiro : 0;
  });
  const dia = rotina[activeDay];

  return (
    <>
      <div className="cli-days-bar">
        {DAYS_SHORT.map((label, d) => {
          const count = rotina[d]?.exercicios.length ?? 0;
          return (
            <button
              key={label}
              className={`cli-day-btn${activeDay === d ? ' active' : ''}`}
              onClick={() => setActiveDay(d)}
            >
              <div className="cli-dl">{label}</div>
              <div className="cli-ds">{count > 0 ? `${count}ex` : '-'}</div>
            </button>
          );
        })}
      </div>

      <div className="cli-day-type">
        {DAYS[activeDay]} — {dia?.tipo ?? 'Descanso Total'}
      </div>

      <div className="cli-ex-list">
        {!dia || dia.exercicios.length === 0 ? (
          <div className="cli-rest-day">💤 Dia de descanso — nenhum exercício programado.</div>
        ) : (
          dia.exercicios.map((ex, i) => (
            <div className="cli-ex-item" key={i}>
              <div className="cli-ex-info">
                <div className="cli-ex-name" title={ex.nome}>
                  {ex.nome}
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
                </div>
                {ex.notes && (
                  <div style={{ fontSize: '0.65rem', color: 'var(--teal)', marginTop: 6, fontStyle: 'italic' }}>
                    # {ex.notes}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
