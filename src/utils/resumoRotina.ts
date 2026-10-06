import type { AlunoRotina } from '../types/aluno';

export interface ResumoRotina {
  /** Índices (0=Seg…6=Dom) dos dias com ao menos um exercício. */
  diasComTreino: number[];
  totalExercicios: number;
}

/** Resumo compacto da semana prescrita, para os cards de "Rotinas". */
export function resumirRotina(rotina: AlunoRotina): ResumoRotina {
  const diasComTreino: number[] = [];
  let totalExercicios = 0;
  rotina.forEach((dia, i) => {
    if (dia.exercicios.length > 0) {
      diasComTreino.push(i);
      totalExercicios += dia.exercicios.length;
    }
  });
  return { diasComTreino, totalExercicios };
}

/** Nenhum dia tem exercício (rascunho/semana em branco). */
export function rotinaSemExercicios(rotina: AlunoRotina): boolean {
  return rotina.every((dia) => dia.exercicios.length === 0);
}
