/**
 * Rascunho local da Avaliação Online — permite ao Aluno sair no meio do
 * preenchimento e continuar depois, antes de enviar pro Personal.
 *
 * Mesmo padrão de storage simples usado em outros wrappers do app
 * (localStorage, prefixo `jg3_`).
 *
 * Escopo local por design: o rascunho nunca vai pro Firestore — só a
 * avaliação finalizada ('enviada') é persistida na nuvem. Isso é
 * intencional (evita gravar dado parcial/inconsistente em produção) e é
 * suficiente pro caso de uso ("continuar depois no mesmo aparelho").
 *
 * SEGURANÇA DO RASCUNHO (contém peso, medidas e triagem de saúde):
 * - DONO: grava `ownerUid` (ver localOwner.ts) e só restaura para o mesmo
 *   dono; rascunho de outra conta é descartado. Sem dono autenticado, não grava.
 * - CONTEXTO: grava `alunoId` e confere com a chave; `assessmentId` precisa ter
 *   formato seguro (ele vira id de documento e chave de foto).
 * - VERSÃO: `v: 2`. Rascunhos sem `v`/`ownerUid` (anteriores) são aceitos e
 *   regravados com dono no próximo avanço de etapa.
 * - TTL: 14 dias sem edição; vencido/inválido/de outro dono é apagado
 *   (e as fotos do rascunho vencido, que só existem neste aparelho).
 * - LIMPEZA TOTAL: logout e troca de dono (localDataLifecycle).
 */


import { deletePhotosByAssessment } from './assessmentPhotoStore';
import { getLocalOwner } from './localOwner';

const PREFIX = 'jg3_online_draft_';
const VERSAO = 2;

/** Validade de um rascunho sem edição (contada a partir de `updatedAt`). */
const RASCUNHO_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** Mesmo formato seguro aceito pelo store de fotos (`af-online-<ts>-<rand>` cabe). */
const ASSESSMENT_ID_SEGURO = /^[A-Za-z0-9_-]{1,128}$/;

export interface OnlineAssessmentDraft<T = unknown> {
  assessmentId: string;
  step: string;
  updatedAt: string;
  data: T;
}

/** Formato gravado: o rascunho do chamador + dono/contexto/versão. */
interface StoredDraft<T = unknown> extends OnlineAssessmentDraft<T> {
  v?: number;
  ownerUid?: string;
  alunoId?: string;
}

type Avaliacao<T> =
  | { estado: 'ok'; draft: StoredDraft<T> }
  | { estado: 'expirado'; draft: StoredDraft<T> }
  | { estado: 'invalido' }
  | { estado: 'outro-dono' };

function chave(alunoId: string): string {
  return `${PREFIX}${alunoId}`;
}

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** `updatedAt` ausente/ilegível também conta como expirado (falha segura). */
function expirado(updatedAt: unknown): boolean {
  const t = typeof updatedAt === 'string' ? Date.parse(updatedAt) : NaN;
  return !Number.isFinite(t) || Date.now() - t > RASCUNHO_TTL_MS;
}

/** Confere envelope, contexto (aluno), dono e validade. `alunoId` = o da chave. */
function avaliar<T>(raw: string | null, alunoId: string, dono: string | null): Avaliacao<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? 'null');
  } catch {
    return { estado: 'invalido' };
  }
  if (!ehObjeto(parsed)) return { estado: 'invalido' };
  const d = parsed as unknown as StoredDraft<T>;

  if (d.v !== undefined && d.v !== VERSAO) return { estado: 'invalido' };
  if (typeof d.assessmentId !== 'string' || !ASSESSMENT_ID_SEGURO.test(d.assessmentId)) return { estado: 'invalido' };
  if (typeof d.step !== 'string' || typeof d.updatedAt !== 'string') return { estado: 'invalido' };
  if (d.alunoId !== undefined && d.alunoId !== alunoId) return { estado: 'invalido' };
  if (d.ownerUid !== undefined && d.ownerUid !== dono) return { estado: 'outro-dono' };
  return { estado: expirado(d.updatedAt) ? 'expirado' : 'ok', draft: d };
}

/** Fotos capturadas para o rascunho (só neste aparelho) ficariam órfãs. */
function descartarFotosDoRascunho(draft: { assessmentId?: unknown } | null): void {
  if (typeof draft?.assessmentId !== 'string' || !ASSESSMENT_ID_SEGURO.test(draft.assessmentId)) return;
  void deletePhotosByAssessment(draft.assessmentId).catch((e) =>
    console.error('onlineAssessmentDraftStore: falha ao descartar fotos do rascunho', e)
  );
}

/**
 * Grava o rascunho para o dono atual. Retorna `false` se NÃO gravou (sem conta
 * autenticada, `assessmentId` inválido, ou localStorage cheio/indisponível) —
 * quem chama deve avisar o usuário em vez de supor que salvou.
 */
export function salvarRascunhoOnline<T>(alunoId: string, draft: OnlineAssessmentDraft<T>): boolean {
  const dono = getLocalOwner();
  if (!dono || !ASSESSMENT_ID_SEGURO.test(draft.assessmentId)) return false;
  try {
    const gravar: StoredDraft<T> = { ...draft, v: VERSAO, ownerUid: dono, alunoId };
    localStorage.setItem(chave(alunoId), JSON.stringify(gravar));
    return true;
  } catch (e) {
    console.error('onlineAssessmentDraftStore: falha ao salvar rascunho', e);
    return false;
  }
}

/**
 * Restaura o rascunho SÓ se for do dono atual, do aluno da chave, dentro do
 * prazo e com envelope válido. Qualquer outro caso apaga e devolve `null`.
 * O conteúdo de `data` NÃO é validado aqui (quem conhece o formato valida).
 */
export function carregarRascunhoOnline<T = unknown>(alunoId: string): OnlineAssessmentDraft<T> | null {
  try {
    const raw = localStorage.getItem(chave(alunoId));
    if (!raw) return null;
    const r = avaliar<T>(raw, alunoId, getLocalOwner());
    if (r.estado === 'ok') {
      const { assessmentId, step, updatedAt, data } = r.draft;
      return { assessmentId, step, updatedAt, data };
    }
    localStorage.removeItem(chave(alunoId));
    if (r.estado === 'expirado') descartarFotosDoRascunho(r.draft);
    return null;
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

/** Varredura (no login): remove vencidos, inválidos e de outro dono — inclusive de clientes que ninguém mais abre. */
export function limparRascunhosExpirados(): void {
  try {
    const dono = getLocalOwner();
    for (const k of chavesDeRascunho()) {
      const r = avaliar<unknown>(localStorage.getItem(k), k.slice(PREFIX.length), dono);
      if (r.estado === 'ok') continue;
      localStorage.removeItem(k);
      if (r.estado === 'expirado') descartarFotosDoRascunho(r.draft);
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
