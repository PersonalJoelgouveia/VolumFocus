import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { TestesScopeValue } from './testesScope';
import { TestesScopeContext, useAlunoMeusTestesScope, usePersonalAlunoScope } from './testesScope';

/** Personal: tudo dentro lê/grava os testes deste aluno (nuvem), não os do próprio Personal. */
export function PersonalAlunoTestesProvider({ alunoEmail, perfil, children }: { alunoEmail: string; perfil?: TestesScopeValue['perfil']; children: ReactNode }) {
  const base = usePersonalAlunoScope(alunoEmail);
  const value = useMemo(() => ({ ...base, perfil }), [base, perfil]);
  return <TestesScopeContext.Provider value={value}>{children}</TestesScopeContext.Provider>;
}

/** Aluno: testes do Personal (só leitura) + os próprios. */
export function AlunoMeusTestesProvider({ children }: { children: ReactNode }) {
  const value = useAlunoMeusTestesScope();
  return <TestesScopeContext.Provider value={value}>{children}</TestesScopeContext.Provider>;
}
