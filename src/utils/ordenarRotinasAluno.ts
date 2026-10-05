import type { AlunoRotinaSalva } from '../types/aluno';

function ts(iso: string): number {
  const n = Date.parse(iso);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Ordem de exibição das rotinas do aluno: a ATIVA primeiro; depois as demais da
 * `atualizadaEm` mais recente para a mais antiga (empate: `criadaEm`, depois `id`,
 * para a ordem ser determinística). Não muta a lista recebida.
 */
export function ordenarRotinasAluno(rotinas: readonly AlunoRotinaSalva[]): AlunoRotinaSalva[] {
  return [...rotinas].sort((a, b) => {
    if (a.ativa !== b.ativa) return a.ativa ? -1 : 1;
    return ts(b.atualizadaEm) - ts(a.atualizadaEm) || ts(b.criadaEm) - ts(a.criadaEm) || a.id.localeCompare(b.id);
  });
}
