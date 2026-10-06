import { fetchPublishedRotina } from './alunoRepository';
import { resolverEmailDoAlunoAutenticado, useMinhasRotinasStore } from '../store/useMinhasRotinasStore';
import type { AlunoRotina } from '../types/aluno';

/**
 * Fonte única da "rotina do Personal que o aluno deve seguir agora".
 *
 *  1. Modelo novo (fonte de verdade): a rotina com `ativa === true` em
 *     `alunos/{email}/rotinas` (via useMinhasRotinasStore — mesma leitura da seção
 *     "Rotinas", compartilhada, identidade do Firebase Auth).
 *  2. Compatibilidade: enquanto o campo legado `alunos/{email}.rotina` existir, ele só
 *     é usado se o aluno NÃO tem nenhuma rotina no modelo novo (ou a leitura do novo
 *     falhou, ex.: regras ainda não publicadas) — nunca quando há rotinas mas nenhuma
 *     ativa (o Personal decidiu não ter rotina atual).
 */
export interface RotinaAtivaResolvida {
  rotina: AlunoRotina;
  /** Muda quando o Personal troca/atualiza a ativa. Legado: o `atualizadoEm` de sempre. */
  version: string;
  origem: 'multiplas' | 'legado';
  /** Nome da rotina (só no modelo novo). */
  nome?: string;
}

/** `null` = nada a sincronizar. Lança só se o modelo novo falhou E o legado também. */
export async function resolverRotinaAtivaDoAluno(): Promise<RotinaAtivaResolvida | null> {
  await useMinhasRotinasStore.getState().carregar();
  const { status, ativa, rotinas } = useMinhasRotinasStore.getState();

  if (status === 'nao-autorizado') return null;
  if (status === 'pronto' && rotinas.length > 0) {
    return ativa
      ? { rotina: ativa.rotina, version: `multi:${ativa.id}@${ativa.atualizadaEm}`, origem: 'multiplas', nome: ativa.nome }
      : null;
  }
  if (status !== 'pronto' && status !== 'erro') return null; // carga descartada (troca de conta/logout)

  // Sem rotinas no modelo novo (ou leitura falhou): comportamento legado.
  const email = resolverEmailDoAlunoAutenticado();
  if (!email) return null;
  const legado = await fetchPublishedRotina(email);
  if (!legado) return null;
  return { rotina: legado.rotina, version: legado.atualizadoEm ?? 'sem-data', origem: 'legado' };
}
