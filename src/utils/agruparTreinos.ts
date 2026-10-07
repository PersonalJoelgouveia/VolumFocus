import { DAYS_SHORT } from '../types/workout';
import type { AlunoRotina, AlunoRotinaDia } from '../types/aluno';

export interface TreinoAgrupado {
  /** "A", "B", "C"… na ordem em que aparecem na semana. */
  letra: string;
  /** Dias (0=Seg…6=Dom) em que este treino se repete, em ordem. */
  dias: number[];
  /** Conteúdo do treino (o do primeiro dia do grupo). */
  dia: AlunoRotinaDia;
}

export interface SemanaAgrupada {
  treinos: TreinoAgrupado[];
  /** Dias sem exercício. */
  descanso: number[];
}

/** Chave de igualdade: tipo + exercícios, ignorando só o NOME dos ids de grupo (Bi-Set etc. vira ordinal). */
function chaveDoDia(dia: AlunoRotinaDia): string {
  const ids: string[] = [];
  const exs = dia.exercicios.map((ex) => {
    if (!ex.groupId) return ex;
    let ord = ids.indexOf(ex.groupId);
    if (ord < 0) ord = ids.push(ex.groupId) - 1;
    return { ...ex, groupId: `g${ord}` };
  });
  return JSON.stringify([dia.tipo.trim().toLowerCase(), exs]);
}

function letraDe(i: number): string {
  return i < 26 ? String.fromCharCode(65 + i) : String(i + 1);
}

/**
 * Agrupa os dias com treino IDÊNTICO (ex.: ABC repetido em 6 dias → 3 treinos). Dias que diferem
 * em qualquer exercício/série/carga viram treinos separados — nada é fundido por aproximação.
 */
export function agruparTreinosDaSemana(rotina: AlunoRotina): SemanaAgrupada {
  const treinos: TreinoAgrupado[] = [];
  const porChave = new Map<string, TreinoAgrupado>();
  const descanso: number[] = [];
  rotina.forEach((dia, d) => {
    if (!dia || dia.exercicios.length === 0) {
      descanso.push(d);
      return;
    }
    const chave = chaveDoDia(dia);
    const existente = porChave.get(chave);
    if (existente) {
      existente.dias.push(d);
      return;
    }
    const novo: TreinoAgrupado = { letra: letraDe(treinos.length), dias: [d], dia };
    treinos.push(novo);
    porChave.set(chave, novo);
  });
  return { treinos, descanso };
}

/** "Seg · Qua · Sex" */
export function formatarDias(dias: number[]): string {
  return dias.map((d) => DAYS_SHORT[d]).join(' · ');
}
