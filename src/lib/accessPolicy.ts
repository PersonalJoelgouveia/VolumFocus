/**
 * Decide o papel liberado no app. O papel NUNCA vem de escolha/dado do cliente:
 *  - Personal  = e-mail verificado do token na lista fixa (espelha as Security Rules);
 *  - aluno     = documento alunos/{email} criado pelo Personal (só o Personal escreve, pelas Rules).
 * Escolher "Sou Personal/Sou aluno" na tela só muda o texto de orientação.
 *
 * Gancho do consentimento de responsável legal (próxima etapa): `guardianPending` deve passar a
 * ser decidido por uma prova VERIFICÁVEL NO SERVIDOR (documento escrito só pelo backend/Rules).
 * Checkbox ou campo do frontend não valem como prova. Hoje é sempre false.
 */
export type AccessRole = 'personal' | 'aluno';

export interface AccessDecision {
  role: AccessRole | null;
  guardianPending: boolean;
}

export function decideAccess(input: { isPT: boolean; alunoDocExists: boolean }): AccessDecision {
  if (input.isPT) return { role: 'personal', guardianPending: false };
  if (input.alunoDocExists) return { role: 'aluno', guardianPending: false };
  return { role: null, guardianPending: false };
}
