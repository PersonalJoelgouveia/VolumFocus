import { useMemo, useState } from 'react';
import { agruparTreinosDaSemana, formatarDias } from '../../utils/agruparTreinos';
import type { TreinoAgrupado } from '../../utils/agruparTreinos';
import { DAYS_SHORT } from '../../types/workout';
import { getTodayDayIndex } from '../../utils/dayIndex';
import type { AlunoRotina } from '../../types/aluno';
import { ListaExerciciosLeitura } from './RotinaSemanaLeitura';
import './MinhasRotinasSection.css';

/**
 * Visão COMPACTA da rotina em leitura: só os treinos distintos (A, B, C…) com os dias em que
 * se repetem, em vez de 7 blocos empilhados. Um treino por vez (abas), descanso em uma linha.
 * Puramente visual — não lê nem escreve em nenhum store.
 */
export function RotinaTreinosLeitura({
  rotina,
  onUsarTreino,
  rotuloUsar = 'Usar',
}: {
  rotina: AlunoRotina;
  /** Se informado, mostra o botão que abre o treino selecionado no DIA ATUAL da Semana Atual. */
  onUsarTreino?: (treino: TreinoAgrupado) => void;
  rotuloUsar?: string;
}) {
  const { treinos, descanso } = useMemo(() => agruparTreinosDaSemana(rotina), [rotina]);
  const [sel, setSel] = useState(0);
  const atual = treinos[Math.min(sel, treinos.length - 1)];

  if (!atual) return <div className="mrs-note">Nenhum treino nesta rotina — todos os dias são de descanso.</div>;

  return (
    <div className="mrs-treinos">
      <div className="mrs-tabs" role="tablist" aria-label="Treinos da rotina">
        {treinos.map((t, i) => (
          <button
            key={t.letra}
            role="tab"
            aria-selected={t === atual}
            className={`mrs-tab${t === atual ? ' active' : ''}`}
            onClick={() => setSel(i)}
          >
            <span className="mrs-tab-letra">Treino {t.letra}</span>
            <span className="mrs-tab-dias">{formatarDias(t.dias)}</span>
          </button>
        ))}
      </div>
      <div className="cli-day-type">
        {atual.dia.tipo} · {atual.dia.exercicios.length} ex.
      </div>
      {onUsarTreino && (
        <button className="btn btn-primary btn-sm btn-full mrs-usar" onClick={() => onUsarTreino(atual)}>
          ▶ {rotuloUsar} Treino {atual.letra} hoje ({DAYS_SHORT[getTodayDayIndex()]})
        </button>
      )}
      <ListaExerciciosLeitura exercicios={atual.dia.exercicios} />
      {descanso.length > 0 && <div className="mrs-descanso mrs-descanso-fim">💤 Descanso: {formatarDias(descanso)}</div>}
    </div>
  );
}
