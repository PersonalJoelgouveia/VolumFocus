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
 * criar uma taxonomia paralela: um Modelo "é" o formato de uma AlunoRotina
 * com metadados de nível — assim "Copiar para Cliente" (useModeloStore)
 * não precisa converter nada, só clonar (JSON.parse(JSON.stringify)) pra
 * nunca alterar o Modelo original ao editar a rotina copiada do Cliente.
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
 * Métodos sugeridos por categoria — só um guia exibido no editor do nível
 * (chips informativos), nunca aplicado automaticamente num exercício. A
 * introdução dos métodos é progressiva: o editor sugere o conjunto da
 * categoria do nível aberto, não uma lista fixa por nível individual.
 */
export const METODOS_SUGERIDOS: Record<ModeloCategoria, string[]> = {
  iniciante: ['Séries tradicionais', 'Controle técnico', 'Padrões fundamentais', 'Progressão básica'],
  intermediario: [
    'Pirâmide crescente',
    'Pirâmide decrescente',
    'Bi-Set',
    'Tri-Set',
    'Superset',
    'Conjugados',
    'Circuitos',
    'Progressão de densidade',
  ],
  avancado: ['Rest-Pause', 'Drop Set', 'Cluster Set', 'FST-7', 'GVT'],
};

/**
 * Modelo de treino de um nível. `rotina` é a semana completa (7 dias),
 * mesmo formato usado em Aluno.rotina — cada dia pode ser preparação/
 * vascularização, mobilidade, força, cardio ou Full Body, sem estrutura
 * rígida imposta aqui (o "tipo" de cada AlunoRotinaDia já é texto livre).
 */
export interface ModeloTreino {
  id: string;
  categoria: ModeloCategoria;
  nivel: ModeloNivel;
  nome: string;
  /** Objetivo textual do nível (ex: "Adaptação anatômica e domínio técnico"). */
  objetivo?: string;
  /** Observações livres do Personal sobre o nível (progressão, cuidados etc). */
  observacoes?: string;
  rotina: AlunoRotina;
  criado: string;
  atualizado?: string;
}

function nomePadrao(categoria: ModeloCategoria, nivel: ModeloNivel): string {
  return `${MODELO_CATEGORIA_LABELS[categoria]} — Nível ${nivel}`;
}

/**
 * Catálogo inicial fixo: 21 modelos vazios (rotina = 7 dias "Descanso
 * Total"), um por categoria×nível. Etapa 1 só cria a prateleira — o
 * conteúdo (exercícios) é preenchido depois, nível a nível, pelo Personal
 * no editor. Ids estáveis (`${categoria}-${nivel}`) pra sobreviver a
 * atualizações futuras do app sem duplicar entradas.
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
