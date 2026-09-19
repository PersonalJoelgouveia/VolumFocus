/**
 * Tipos do domínio "Modelos de Treino" (Ferramentas > Modelos).
 *
 * Independente de Rotinas Salvas (types/workout.ts Rotina/WeekLog, que
 * pertencem ao log/execução do próprio usuário) — Modelos é uma biblioteca
 * do Personal, organizada em 21 níveis fixos (3 categorias × 7 níveis),
 * pensada como ponto de partida pra montar a rotina de um Cliente.
 *
 * Reaproveita deliberadamente o mesmo schema de rotina do Cliente
 * (AlunoRotina/AlunoRotinaDia/AlunoExercicio, ver types/aluno.ts) em vez de
 * criar uma taxonomia paralela, mesmo nesta etapa em que a rotina de cada
 * nível ainda nasce vazia — assim o editor de conteúdo (etapa futura) e o
 * fluxo "Copiar para Cliente" (etapa futura) não vão precisar converter
 * nada, só clonar.
 */

import type { AlunoRotina } from './aluno';
import { criarRotinaVazia } from './aluno';

export type ModeloCategoria = 'iniciante' | 'intermediario' | 'avancado';

export const MODELO_CATEGORIAS: ModeloCategoria[] = ['iniciante', 'intermediario', 'avancado'];

export const MODELO_CATEGORIA_LABELS: Record<ModeloCategoria, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
};

/** 7 níveis por categoria — 21 no total (REGRA definida pelo Joel). */
export type ModeloNivel = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const MODELO_NIVEIS: ModeloNivel[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * Modelo de treino de um nível. `rotina` é a semana completa (7 dias),
 * mesmo formato usado em Aluno.rotina. Nesta etapa a rotina de todo modelo
 * nasce vazia (7 dias "Descanso Total") — o conteúdo (exercícios) é uma
 * etapa futura, preenchida nível a nível pelo Personal.
 */
export interface ModeloTreino {
  id: string;
  categoria: ModeloCategoria;
  nivel: ModeloNivel;
  nome: string;
  rotina: AlunoRotina;
  criado: string;
}

function nomePadrao(categoria: ModeloCategoria, nivel: ModeloNivel): string {
  return `${MODELO_CATEGORIA_LABELS[categoria]} — Nível ${nivel}`;
}

/**
 * Catálogo inicial fixo: 21 modelos vazios, um por categoria×nível. Esta
 * etapa só cria a prateleira (navegação/cards/estados vazios) — sem editor
 * de conteúdo e sem fluxo de cópia ainda. Ids estáveis
 * (`${categoria}-${nivel}`) pra sobreviver a atualizações futuras do app
 * sem duplicar entradas.
 */
export function criarCatalogoInicial(): ModeloTreino[] {
  const agora = new Date().toISOString();
  const modelos: ModeloTreino[] = [];
  for (const categoria of MODELO_CATEGORIAS) {
    for (const nivel of MODELO_NIVEIS) {
      modelos.push({
        id: `${categoria}-${nivel}`,
        categoria,
        nivel,
        nome: nomePadrao(categoria, nivel),
        rotina: criarRotinaVazia(),
        criado: agora,
      });
    }
  }
  return modelos;
}

/** Total de exercícios (força+cardio) cadastrados no modelo, somando os 7 dias. */
export function contarExercicios(modelo: ModeloTreino): number {
  return modelo.rotina.reduce((acc, dia) => acc + dia.exercicios.length, 0);
}

export function modeloEstaVazio(modelo: ModeloTreino): boolean {
  return contarExercicios(modelo) === 0;
}
