/**
 * Decide o papel liberado no app. O papel NUNCA vem de escolha/dado do cliente:
 *  - Personal    = e-mail verificado do token na lista fixa (espelha as Security Rules);
 *  - aluno       = documento alunos/{email} criado pelo Personal (só o Personal escreve, pelas Rules);
 *  - responsável = e-mail verificado vinculado em responsaveis/{aluno} pelo Personal dono do menor.
 * Escolher "Sou Personal/Sou aluno" na tela só muda o texto de orientação.
 *
 * Menor de 18: o aluno só é liberado com a autorização do responsável VIGENTE (tratamento de dados +
 * atendimento), lida do Firestore e imposta também pelas Rules (consentOk). Um checkbox ou campo do
 * frontend nunca vale como prova. O responsável NÃO recebe acesso ao app: só ao painel de autorização.
 */
export type AccessRole = 'personal' | 'aluno' | 'responsavel';

export interface AccessDecision {
  role: AccessRole | null;
  guardianPending: boolean;
}

export function decideAccess(input: {
  isPT: boolean;
  alunoDocExists: boolean;
  /** O aluno ainda é menor (alunos/{email}.maioridadeEm no futuro). */
  menor?: boolean;
  /** Autorização obrigatória do responsável vigente. Só relevante se `menor`. */
  consentimentoOk?: boolean;
  /** Há menor(es) vinculado(s) a este e-mail como responsável. */
  responsavelVinculado?: boolean;
}): AccessDecision {
  if (input.isPT) return { role: 'personal', guardianPending: false };
  if (input.alunoDocExists) {
    const pendente = input.menor === true && input.consentimentoOk !== true;
    return { role: 'aluno', guardianPending: pendente };
  }
  if (input.responsavelVinculado) return { role: 'responsavel', guardianPending: false };
  return { role: null, guardianPending: false };
}
