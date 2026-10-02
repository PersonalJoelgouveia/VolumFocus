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

/** Validade de um rascunho sem edição (contada a partir de `updatedAt`). */
const RASCUNHO_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** `updatedAt` ausente/ilegível também conta como expirado (falha segura). */
function rascunhoExpirado(draft: { updatedAt?: string } | null): boolean {
  const t = draft?.updatedAt ? Date.parse(draft.updatedAt) : NaN;
  return !Number.isFinite(t) || Date.now() - t > RASCUNHO_TTL_MS;
}

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
    if (!raw) return null;
    const draft = JSON.parse(raw) as OnlineAssessmentDraft<T>;
    // Rascunho com dado de saúde não pode ficar para sempre no aparelho.
    if (rascunhoExpirado(draft)) {
      localStorage.removeItem(chave(alunoId));
      return null;
    }
    return draft;
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

function chavesDeRascunho(): string[] {
  const chaves: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) chaves.push(k);
  }
  return chaves;
}

/** Remove os rascunhos vencidos (inclusive de clientes que ninguém mais abre). */
export function limparRascunhosExpirados(): void {
  try {
    for (const k of chavesDeRascunho()) {
      let draft: { updatedAt?: string } | null = null;
      try {
        draft = JSON.parse(localStorage.getItem(k) ?? 'null');
      } catch {
        /* JSON inválido → trata como expirado */
      }
      if (rascunhoExpirado(draft)) localStorage.removeItem(k);
    }
  } catch (e) {
    console.error('onlineAssessmentDraftStore: falha ao limpar rascunhos expirados', e);
  }
}

/** Remove TODOS os rascunhos (logout / troca de dono dos dados locais). */
export function limparTodosRascunhosOnline(): void {
  try {
    chavesDeRascunho().forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    console.error('onlineAssessmentDraftStore: falha ao limpar rascunhos', e);
  }
}
