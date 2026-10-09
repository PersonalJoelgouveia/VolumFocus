/**
 * Rascunho local da Avaliação Online — permite ao Aluno sair no meio do
 * preenchimento e continuar depois, antes de enviar pro Personal.
 *
 * Mesmo padrão de storage simples usado em outros wrappers do app
 * (localStorage, prefixo `jg3_`).
 *
 * Escopo local por design: o rascunho nunca vai pro Firestore — só a
 * avaliação finalizada ('enviada') é persistida na nuvem (e lá quem autoriza são
 * as Security Rules, via request.auth.uid). Isso é intencional (evita gravar dado
 * parcial/inconsistente em produção) e é suficiente pro caso de uso ("continuar
 * depois no mesmo aparelho").
 *
 * NAMESPACE POR OWNERSHIP (isolamento LÓGICO local — o localStorage é por origem,
 * não por usuário). Chave:
 *
 *     jg3_online_draft_${ownerUUID}:${encodeURIComponent(alunoId)}
 *
 * (dono + cliente) e o envelope grava `ownerUUID`, `alunoId` e `assessmentId`, todos
 * conferidos na leitura (dono + cliente + avaliação). Há um rascunho por (dono,
 * cliente): o `assessmentId` não entra na chave porque é gerado junto com o
 * rascunho e só se conhece DEPOIS de carregá-lo; ele vai no envelope, valida-se o
 * formato e é ele que liga o rascunho às fotos (também namespaceadas por dono+cliente).
 * O ownerUUID vem da sessão (localOwner.ts), NUNCA de argumento: quem tem outro
 * ownerUUID, ou pede outro `alunoId`, não monta a chave. O ownerUUID não é segredo nem
 * autoriza nada; sem sessão/ownerUUID resolvido, não grava nem restaura.
 *
 * SEGURANÇA DO RASCUNHO (contém peso, medidas e triagem de saúde):
 * - Envelope `v: 3`. `assessmentId` precisa ter formato seguro (vira id de documento e
 *   chave de foto). Rascunho copiado para a chave de outro cliente/dono é rejeitado.
 * - LEGADO (`jg3_online_draft_${alunoId}`, v2): adotado (movido) só se o `ownerUid`
 *   gravado for o da sessão e o `alunoId` conferir. Sem dono gravado (anterior ao
 *   controle de dono) NÃO é adotado — não dá para provar de quem é; fica no aparelho
 *   até vencer. Nada de outro dono é apagado ao abrir/ler.
 * - TTL: 14 dias sem edição; vencido/inválido do dono atual é apagado
 *   (e as fotos do rascunho vencido, que só existem neste aparelho).
 * - LIMPEZA TOTAL: logout e troca de dono (localDataLifecycle).
 */


import { deletePhotosByAssessment } from './assessmentPhotoStore';
import { getLocalAuthUid, getLocalOwnerUUID } from './localOwner';

const PREFIX = 'jg3_online_draft_';
const VERSAO = 3;
const VERSAO_LEGADA = 2;

/** Validade de um rascunho sem edição (contada a partir de `updatedAt`). */
const RASCUNHO_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** Mesmo formato seguro aceito pelo store de fotos (`af-online-<ts>-<rand>` cabe). */
const ASSESSMENT_ID_SEGURO = /^[A-Za-z0-9_-]{1,128}$/;

/** Parte inicial (ownerUUID + ':') de uma chave nova — distingue da chave legada (`${alunoId}`). */
const CHAVE_NOVA = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:/;

export interface OnlineAssessmentDraft<T = unknown> {
  assessmentId: string;
  step: string;
  updatedAt: string;
  data: T;
}

/** Formato gravado: o rascunho do chamador + dono/contexto/versão. */
interface StoredDraft<T = unknown> extends OnlineAssessmentDraft<T> {
  v?: number;
  /** v3: dono local (namespace). */
  ownerUUID?: string;
  /** v2 (legado): uid do Firebase do dono. */
  ownerUid?: string;
  alunoId?: string;
}

type Avaliacao<T> = { estado: 'ok' | 'expirado'; draft: StoredDraft<T> } | { estado: 'invalido' };

function alunoValido(alunoId: unknown): alunoId is string {
  return typeof alunoId === 'string' && alunoId.length > 0 && alunoId.length <= 200;
}

/** ownerUUID da sessão — NUNCA de argumento. `null` = sem sessão/ownerUUID resolvido (nada grava nem restaura). */
function dono(): string | null {
  return getLocalOwnerUUID();
}

/** Chave atual: dono + cliente. */
function chave(owner: string, alunoId: string): string {
  return `${PREFIX}${owner}:${encodeURIComponent(alunoId)}`;
}

/** Chave legada (v2): só o cliente. */
function chaveLegada(alunoId: string): string {
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

function lerJson(raw: string | null): StoredDraft | null {
  try {
    const parsed: unknown = JSON.parse(raw ?? 'null');
    return ehObjeto(parsed) ? (parsed as unknown as StoredDraft) : null;
  } catch {
    return null;
  }
}

/** Confere envelope comum (avaliação, etapa, data) e validade. */
function envelopeOk<T>(d: StoredDraft<T> | null): d is StoredDraft<T> {
  return (
    !!d &&
    typeof d.assessmentId === 'string' &&
    ASSESSMENT_ID_SEGURO.test(d.assessmentId) &&
    typeof d.step === 'string' &&
    typeof d.updatedAt === 'string'
  );
}

/** v3: dono + cliente + avaliação conferidos contra o que a SESSÃO pede (não contra a chave). */
function avaliar<T>(raw: string | null, owner: string, alunoId: string): Avaliacao<T> {
  const d = lerJson(raw) as StoredDraft<T> | null;
  if (!envelopeOk(d) || d.v !== VERSAO || d.ownerUUID !== owner || d.alunoId !== alunoId) return { estado: 'invalido' };
  return { estado: expirado(d.updatedAt) ? 'expirado' : 'ok', draft: d };
}

/** v2: só vale se o dono gravado for o uid da sessão e o cliente conferir (sem dono não dá para provar). */
function avaliarLegado<T>(raw: string | null, uid: string | null, alunoId: string): Avaliacao<T> {
  const d = lerJson(raw) as StoredDraft<T> | null;
  if (!envelopeOk(d) || d.v !== VERSAO_LEGADA || !uid || d.ownerUid !== uid || d.alunoId !== alunoId) return { estado: 'invalido' };
  return { estado: expirado(d.updatedAt) ? 'expirado' : 'ok', draft: d };
}

/** Fotos capturadas para o rascunho (só neste aparelho) ficariam órfãs. */
function descartarFotosDoRascunho(alunoId: string, draft: { assessmentId?: unknown } | null): void {
  if (typeof draft?.assessmentId !== 'string' || !ASSESSMENT_ID_SEGURO.test(draft.assessmentId)) return;
  // As fotos são do (dono, cliente) do rascunho: a chave inclui o alunoId.
  void deletePhotosByAssessment(alunoId, draft.assessmentId).catch((e) =>
    console.error('onlineAssessmentDraftStore: falha ao descartar fotos do rascunho', e)
  );
}

/** Remove a cópia legada (v2) do cliente SOMENTE se for deste uid — nunca a de outra conta. */
function removerLegadoProprio(alunoId: string): void {
  const uid = getLocalAuthUid();
  const k = chaveLegada(alunoId);
  const d = lerJson(localStorage.getItem(k));
  if (uid && d && d.v === VERSAO_LEGADA && d.ownerUid === uid && d.alunoId === alunoId) localStorage.removeItem(k);
}

/**
 * Grava o rascunho para o dono atual. Retorna `false` se NÃO gravou (sem conta
 * autenticada/ownerUUID resolvido, `assessmentId`/`alunoId` inválido, ou localStorage
 * cheio/indisponível) — quem chama deve avisar o usuário em vez de supor que salvou.
 */
export function salvarRascunhoOnline<T>(alunoId: string, draft: OnlineAssessmentDraft<T>): boolean {
  const owner = dono();
  if (!owner || !alunoValido(alunoId) || !ASSESSMENT_ID_SEGURO.test(draft.assessmentId)) return false;
  try {
    const gravar: StoredDraft<T> = { ...draft, v: VERSAO, ownerUUID: owner, alunoId };
    localStorage.setItem(chave(owner, alunoId), JSON.stringify(gravar));
    removerLegadoProprio(alunoId); // já existe a versão nova: o v2 do mesmo cliente não pode ressuscitar
    return true;
  } catch (e) {
    console.error('onlineAssessmentDraftStore: falha ao salvar rascunho', e);
    return false;
  }
}

/**
 * Restaura o rascunho SÓ se for do (dono, cliente) atuais, dentro do prazo e com
 * envelope válido. Inválido/vencido do próprio escopo é apagado; o de OUTRO dono ou
 * cliente nem é visto (outra chave) e nunca é tocado. Adota o legado v2 do próprio uid.
 * O conteúdo de `data` NÃO é validado aqui (quem conhece o formato valida).
 */
export function carregarRascunhoOnline<T = unknown>(alunoId: string): OnlineAssessmentDraft<T> | null {
  const owner = dono();
  if (!owner || !alunoValido(alunoId)) return null;
  try {
    const k = chave(owner, alunoId);
    const raw = localStorage.getItem(k);
    if (raw) {
      const r = avaliar<T>(raw, owner, alunoId);
      if (r.estado === 'ok') return pronto(r.draft);
      localStorage.removeItem(k);
      if (r.estado === 'expirado') descartarFotosDoRascunho(alunoId, r.draft);
      return null;
    }
    return adotarLegado<T>(owner, alunoId);
  } catch (e) {
    console.error('onlineAssessmentDraftStore: falha ao carregar rascunho', e);
    return null;
  }
}

function pronto<T>(d: StoredDraft<T>): OnlineAssessmentDraft<T> {
  const { assessmentId, step, updatedAt, data } = d;
  return { assessmentId, step, updatedAt, data };
}

/** v2 → v3: move para a chave nova só se o uid gravado for o da sessão e o cliente conferir. */
function adotarLegado<T>(owner: string, alunoId: string): OnlineAssessmentDraft<T> | null {
  const kv = chaveLegada(alunoId);
  const raw = localStorage.getItem(kv);
  if (!raw) return null;
  const r = avaliarLegado<T>(raw, getLocalAuthUid(), alunoId);
  if (r.estado === 'invalido') return null; // de outra conta/sem dono: não é nosso — não toca
  localStorage.removeItem(kv);
  if (r.estado === 'expirado') {
    descartarFotosDoRascunho(alunoId, r.draft);
    return null;
  }
  const novo: StoredDraft<T> = { ...pronto(r.draft), v: VERSAO, ownerUUID: owner, alunoId };
  localStorage.setItem(chave(owner, alunoId), JSON.stringify(novo));
  return pronto(r.draft);
}

/** Descarta o rascunho do (dono, cliente) atuais (envio concluído, cliente removido). Nunca toca em outro escopo. */
export function limparRascunhoOnline(alunoId: string): void {
  const owner = dono();
  if (!owner || !alunoValido(alunoId)) return;
  try {
    localStorage.removeItem(chave(owner, alunoId));
    removerLegadoProprio(alunoId);
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

/**
 * Varredura (no login): remove vencidos/inválidos do dono ATUAL — inclusive de clientes que ninguém
 * mais abre — e legado v2 do próprio uid. Rascunhos de outro dono ficam intactos (não são nossos
 * para julgar); o legado sem dono só sai quando vence (ou está ilegível).
 */
export function limparRascunhosExpirados(): void {
  const owner = dono();
  if (!owner) return;
  try {
    const uid = getLocalAuthUid();
    for (const k of chavesDeRascunho()) {
      const resto = k.slice(PREFIX.length);
      if (CHAVE_NOVA.test(resto)) {
        if (!resto.startsWith(`${owner}:`)) continue; // outro dono
        let alunoId: string;
        try {
          alunoId = decodeURIComponent(resto.slice(owner.length + 1));
        } catch {
          localStorage.removeItem(k);
          continue;
        }
        const r = avaliar<unknown>(localStorage.getItem(k), owner, alunoId);
        if (r.estado === 'ok') continue;
        localStorage.removeItem(k);
        if (r.estado === 'expirado') descartarFotosDoRascunho(alunoId, r.draft);
        continue;
      }
      // legado: `${alunoId}`
      const raw = localStorage.getItem(k);
      const mine = avaliarLegado<unknown>(raw, uid, resto);
      if (mine.estado === 'expirado') {
        localStorage.removeItem(k);
        descartarFotosDoRascunho(resto, mine.draft);
      } else if (mine.estado === 'invalido') {
        const d = lerJson(raw);
        // Ilegível, ou sem dono e vencido: lixo seguro de apagar. Com dono (outra conta): não mexe.
        if (!d || (d.ownerUid === undefined && (!envelopeOk(d) || expirado(d.updatedAt)))) localStorage.removeItem(k);
      }
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
