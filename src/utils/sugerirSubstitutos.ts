/**
 * Sugestão de exercícios substitutos pra "Substituir exercício" (rotina do
 * Cliente, ExercicioFormModal.tsx). Usa exclusivamente a taxonomia que já
 * existe em Exercise (types/exercise.ts) — agonista, sinergistas,
 * estabilizadores. Equipamento e nível de treinamento NÃO entram no
 * ranking porque esses campos ainda não existem no Banco de Exercícios
 * (ver auditoria anterior do Banco) — usar heurística de texto no nome
 * pra inferir equipamento violaria "usar exclusivamente a taxonomia
 * atual", então fica de fora até o Banco ganhar esses campos de verdade.
 *
 * Prioridade (nessa ordem, cada critério só desempata o anterior):
 * 1. Mesmo agonista (ex: Supino Reto → prioriza outros exercícios de Peito)
 * 2. Nº de sinergistas em comum
 * 3. Nº de estabilizadores em comum
 *
 * Puro — não muta nada, não sabe nada de rotina/modelo. A troca em si
 * (aplicar o substituto escolhido na rotina do Cliente) acontece no
 * componente que chama isso; TrainingModel nunca é tocado por esse fluxo.
 */

import type { Exercise } from '../types/exercise';

export interface SugestaoSubstituto {
  exercise: Exercise;
  motivo: string;
}

/** Resolve um Exercise pelo nome (case-insensitive) — mesma convenção de
 *  casamento por nome usada em utils/importAlunoRotina.ts. Retorna
 *  undefined se o nome não bater com nada do banco atual (ex: nome
 *  digitado à mão, sem vínculo) — nesse caso não há base pra ranquear. */
export function resolverExercisePorNome(nome: string, exercises: Exercise[]): Exercise | undefined {
  const key = nome.trim().toLowerCase();
  return exercises.find((e) => e.name.trim().toLowerCase() === key);
}

function montarMotivo(mesmoAgonista: boolean, sinergistasComuns: number, estabilizadoresComuns: number): string {
  if (mesmoAgonista) return 'Mesmo agonista';
  if (sinergistasComuns > 0) return `${sinergistasComuns} sinergista${sinergistasComuns > 1 ? 's' : ''} em comum`;
  return `${estabilizadoresComuns} estabilizador${estabilizadoresComuns > 1 ? 'es' : ''} em comum`;
}

/**
 * Sugere até `limite` substitutos pra `atual`, ranqueados pela taxonomia
 * (ver cabeçalho do arquivo). Só retorna exercícios com alguma relação
 * real (mesmo agonista OU sinergista/estabilizador em comum) — sem
 * relação nenhuma não é uma "sugestão", é ruído; pra isso existe a busca
 * manual.
 */
export function sugerirSubstitutos(atual: Exercise, exercises: Exercise[], limite = 8): SugestaoSubstituto[] {
  const sinergistasAtual = new Set(atual.synergist);
  const estabilizadoresAtual = new Set(atual.stabilizer);

  return exercises
    .filter((e) => e.id !== atual.id)
    .map((e) => {
      const mesmoAgonista = e.agonist === atual.agonist;
      const sinergistasComuns = e.synergist.filter((s) => sinergistasAtual.has(s)).length;
      const estabilizadoresComuns = e.stabilizer.filter((s) => estabilizadoresAtual.has(s)).length;
      return { exercise: e, mesmoAgonista, sinergistasComuns, estabilizadoresComuns };
    })
    .filter((c) => c.mesmoAgonista || c.sinergistasComuns > 0 || c.estabilizadoresComuns > 0)
    .sort((a, b) => {
      if (a.mesmoAgonista !== b.mesmoAgonista) return a.mesmoAgonista ? -1 : 1;
      if (b.sinergistasComuns !== a.sinergistasComuns) return b.sinergistasComuns - a.sinergistasComuns;
      if (b.estabilizadoresComuns !== a.estabilizadoresComuns) return b.estabilizadoresComuns - a.estabilizadoresComuns;
      return a.exercise.name.localeCompare(b.exercise.name, 'pt-BR');
    })
    .slice(0, limite)
    .map((c) => ({ exercise: c.exercise, motivo: montarMotivo(c.mesmoAgonista, c.sinergistasComuns, c.estabilizadoresComuns) }));
}
