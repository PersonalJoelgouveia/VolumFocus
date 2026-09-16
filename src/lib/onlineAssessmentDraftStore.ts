/**
 * Rascunho local da Avaliação Online — permite ao Aluno sair no meio do
 * preenchimento e continuar depois, antes de enviar pro Personal.
 *
 * Mesmo padrão de storage simples usado em outros wrappers do app
 * (localStorage, prefixo `jg3_`) — sem teste, mesmo padrão de
 * localVideoStore/alunoRepository (wrapper de storage não testável sem
 * mock pesado).
 *
 * Escopo local por design: o rascunho nunca vai pro Firestore — só a
 * avaliação finalizada ('enviada') é persistida na nuvem. Isso é
 * intencional (evita gravar dado parcial/inconsistente em produção) e é
 * suficiente pro caso de uso ("continuar depois no mesmo aparelho").
 */

const PREFIX = 'jg3_online_draft_';

export interface OnlineAssessmentDraft<T = unknown> {
  assessmentId: string;
  step: string;
  updatedAt: string;
  data: T;
}

function chave(alunoId: string): string {
  return `${PREFIX}${alunoId}`;
}

export function salvarRascunhoOnline<T>(alunoId: string, draft: OnlineAssessmentDraft<T>): void {
  try {
    localStorage.setItem(chave(alunoId), JSON.stringify(draft));
  } catch (e) {
    console.error('onlineAssessmentDraftStore: falha ao salvar rascunho', e);
  }
}

export function carregarRascunhoOnline<T>(alunoId: string): OnlineAssessmentDraft<T> | null {
  try {
    const raw = localStorage.getItem(chave(alunoId));
    return raw ? (JSON.parse(raw) as OnlineAssessmentDraft<T>) : null;
  } catch (e) {
    console.error('onlineAssessmentDraftStore: falha ao carregar rascunho', e);
    return null;
  }
}

export function limparRascunhoOnline(alunoId: string): void {
  try {
    localStorage.removeItem(chave(alunoId));
  } catch (e) {
    console.error('onlineAssessmentDraftStore: falha ao limpar rascunho', e);
  }
}
