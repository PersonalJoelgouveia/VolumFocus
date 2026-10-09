/**
 * Vídeo pessoal do exercício — armazenado EXCLUSIVAMENTE no dispositivo
 * via IndexedDB (Blob nativo, nunca Base64/localStorage, nunca upload
 * pro Firebase/Storage). Diferente das imagens de execução e do vídeo
 * do YouTube (ambos gerenciados pelo Personal, compartilhados via
 * Firestore/Storage — ver lib/exerciseMediaRepository.ts), este é o
 * registro PESSOAL de quem está treinando, só para referência própria
 * naquele aparelho.
 *
 * NAMESPACE POR OWNERSHIP (isolamento LÓGICO local): o IndexedDB é isolado por
 * ORIGEM, não por usuário nem por cliente — duas contas no mesmo navegador
 * compartilham o banco. A chave de cada vídeo é
 *
 *     ${ownerUUID}:${escopo}:${encodeURIComponent(exerciseId)}:${videoId}
 *       escopo = `a=${encodeURIComponent(alunoId)}`  (gravado na sessão de um aluno)
 *              | `self`                                ("Meu Treino" / modo aluno)
 *       videoId = `principal`  (um vídeo por exercício/escopo; salvar de novo SUBSTITUI)
 *
 * (dono + cliente + exercício + vídeo). O ownerUUID NÃO vem de argumento: é lido
 * aqui dentro da sessão autenticada (localOwner.ts, vínculo Auth UID → ownerUUID).
 * Logo nenhum chamador consegue pedir "o vídeo do usuário X": quem tem outro
 * ownerUUID, ou pede outro `alunoId`, não monta a chave e não encontra o registro.
 * `:` nunca aparece dentro de um componente (ownerUUID é UUID; id de cliente e de
 * exercício são codificados), então chaves de escopos diferentes não se confundem.
 * Não existe API que liste/enumere vídeos de outro dono.
 *
 * O ownerUUID NÃO é segredo e NÃO autoriza nada: só separa espaços de
 * armazenamento. Sem sessão autorizada / sem ownerUUID resolvido, nenhum vídeo é
 * acessível (falha segura). Limite honesto: isto é isolamento LÓGICO — quem tem
 * DevTools aberto no MESMO navegador consegue inspecionar o IndexedDB; não há
 * criptografia aqui.
 *
 * LEGADO (cache existente preservado — nada é apagado por heurística):
 *   sem cliente : `${email}_${exerciseId}`
 *   com cliente : `${email}:${clienteId}:${exerciseId}`
 * É "adotado" (movido para a chave nova, na MESMA transação) no 1º acesso, e só
 * se o e-mail da chave for o da sessão autenticada e o registro confirmar o mesmo
 * exercício/cliente. Sem adoção o vídeo continua no aparelho, só não aparece.
 *
 * LIMPEZA: sem varredura heurística — o vídeo é cópia única. Só se apaga o
 * que se PROVA órfão: remoção explícita do vídeo, do exercício ou do aluno.
 */

import { getFreeStorageBytes, requestPersistentStorage } from './storageQuota';
import { getLocalAuthEmail, getLocalOwnerUUID } from './localOwner';

const DB_NAME = 'volumfocus-media';
const DB_VERSION = 1;
const STORE_NAME = 'personal-videos';

/** videoId fixo: hoje há UM vídeo por (dono, cliente, exercício). */
const VIDEO_PRINCIPAL = 'principal';

export interface PersonalVideoRecord {
  id: string;
  exerciseId: string;
  /** Dono local (namespace). Ausente só em registros legados até serem adotados. */
  ownerUUID?: string;
  videoId?: string;
  /** Legado (namespace por e-mail). Registros novos não gravam e-mail. */
  userEmail?: string;
  /** alunoId do cliente — presente quando gravado dentro da sessão de um aluno. */
  clienteId?: string;
  blob: Blob;
  mimeType: string;
  createdAt: string;
  sizeBytes: number;
}

/** O vídeo não cabe no espaço livre do navegador (nada foi alterado). */
export class VideoStorageFullError extends Error {
  constructor() {
    super('Sem espaço suficiente no dispositivo para salvar este vídeo');
    this.name = 'VideoStorageFullError';
  }
}
export function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error('IndexedDB indisponível neste navegador'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Falha ao abrir IndexedDB'));
  });
}

/**
 * Abre o banco, roda UMA transação e FECHA a conexão ao terminar (antes ficavam
 * abertas para sempre). Resolve só no `complete`; `abort` (ex.: cota estourada,
 * que NÃO dispara `error` na transação) rejeita em vez de deixar a Promise
 * pendurada.
 */
function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore, done: (value: T) => void) => void
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let result: T;
        const tx = db.transaction(STORE_NAME, mode);
        tx.oncomplete = () => {
          db.close();
          resolve(result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error('Falha na operação de vídeo'));
        };
        tx.onabort = () => {
          db.close();
          const err = tx.error;
          reject(err?.name === 'QuotaExceededError' ? new VideoStorageFullError() : err ?? new Error('Operação de vídeo abortada'));
        };
        try {
          work(tx.objectStore(STORE_NAME), (value) => {
            result = value;
          });
        } catch (e) {
          try {
            tx.abort();
          } catch {
            /* já encerrada */
          }
          db.close();
          reject(e);
        }
      })
  );
}

/** `alunoId`/`exerciseId` entram na chave: só texto não vazio e de tamanho razoável. */
function idOk(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= 200;
}

interface Escopo {
  owner: string;
  /** e-mail da sessão (só para adotar legado), se houver. */
  email: string | null;
  exerciseId: string;
  clienteId: string | null;
}

/** Escopo de UMA chamada. O dono vem da sessão — nunca de argumento. */
function escopoDe(exerciseId: string, clienteId?: string | null): Escopo {
  const owner = getLocalOwnerUUID();
  if (!owner) throw new Error('Vídeos indisponíveis: nenhuma conta autenticada/ownerUUID neste dispositivo');
  if (!idOk(exerciseId)) throw new Error('Identificador de exercício inválido para vídeo');
  if (clienteId != null && !idOk(clienteId)) throw new Error('Identificador de cliente inválido para vídeo');
  return { owner, email: getLocalAuthEmail(), exerciseId, clienteId: clienteId ?? null };
}

function donoOwner(): string {
  const owner = getLocalOwnerUUID();
  if (!owner) throw new Error('Vídeos indisponíveis: nenhuma conta autenticada/ownerUUID neste dispositivo');
  return owner;
}

function segmento(clienteId: string | null): string {
  return clienteId ? `a=${encodeURIComponent(clienteId)}` : 'self';
}

function videoKey(e: Escopo): string {
  return `${e.owner}:${segmento(e.clienteId)}:${encodeURIComponent(e.exerciseId)}:${VIDEO_PRINCIPAL}`;
}

/** Chave legada (namespace por e-mail) do mesmo escopo; `null` se a sessão não tem e-mail. */
function legacyKey(e: Escopo): string | null {
  if (!e.email) return null;
  return e.clienteId ? `${e.email}:${e.clienteId}:${e.exerciseId}` : `${e.email}_${e.exerciseId}`;
}

/** O registro legado é mesmo deste e-mail/exercício/cliente? (a chave sozinha não basta) */
function legadoConfere(rec: PersonalVideoRecord | undefined, e: Escopo): rec is PersonalVideoRecord {
  return (
    !!rec &&
    rec.userEmail?.toLowerCase() === e.email &&
    rec.exerciseId === e.exerciseId &&
    (rec.clienteId ?? null) === e.clienteId
  );
}

function novoRegistro(e: Escopo, blob: Blob, base?: Partial<PersonalVideoRecord>): PersonalVideoRecord {
  return {
    id: videoKey(e),
    exerciseId: e.exerciseId,
    ownerUUID: e.owner,
    videoId: VIDEO_PRINCIPAL,
    ...(e.clienteId ? { clienteId: e.clienteId } : {}),
    blob,
    mimeType: base?.mimeType ?? (blob.type || 'video/webm'),
    createdAt: base?.createdAt ?? new Date().toISOString(),
    sizeBytes: blob.size,
  };
}

/** Tamanho do vídeo já salvo neste escopo (0 se não houver) — será liberado pela substituição. */
function existingSize(e: Escopo): Promise<number> {
  const legado = legacyKey(e);
  return withStore<number>('readonly', (store, done) => {
    store.get(videoKey(e)).onsuccess = (ev) => {
      const rec = (ev.target as IDBRequest<PersonalVideoRecord | undefined>).result;
      if (rec || !legado) return done(rec?.sizeBytes ?? 0);
      store.get(legado).onsuccess = (ev2) => {
        const old = (ev2.target as IDBRequest<PersonalVideoRecord | undefined>).result;
        done(legadoConfere(old, e) ? old.sizeBytes : 0);
      };
    };
  });
}

/**
 * Salva (ou substitui) o vídeo pessoal do exercício — só neste dispositivo.
 * Antes de gravar confere o espaço livre estimado (a substituição devolve o
 * tamanho do vídeo antigo); se não couber, lança `VideoStorageFullError` sem
 * tocar no vídeo existente. Um legado do mesmo escopo é removido na mesma
 * transação (senão ficaria uma cópia velha ocupando espaço).
 */
export async function savePersonalVideo(exerciseId: string, blob: Blob, clienteId?: string | null): Promise<void> {
  const e = escopoDe(exerciseId, clienteId);

  const livre = await getFreeStorageBytes();
  if (livre !== null && blob.size > livre + (await existingSize(e))) {
    throw new VideoStorageFullError();
  }

  const legado = legacyKey(e);
  await withStore<void>('readwrite', (store, done) => {
    store.put(novoRegistro(e, blob));
    if (legado) {
      store.get(legado).onsuccess = (ev) => {
        if (legadoConfere((ev.target as IDBRequest<PersonalVideoRecord | undefined>).result, e)) store.delete(legado);
      };
    }
    done();
  });

  requestPersistentStorage(); // cópia única: pede para o navegador não descartar
}

/**
 * Busca o vídeo pessoal deste (dono, cliente, exercício) — `null` se nunca foi gravado aqui,
 * ou se pertence a outro dono/cliente. Adota o legado (por e-mail) quando for o caso.
 */
export async function getPersonalVideo(exerciseId: string, clienteId?: string | null): Promise<PersonalVideoRecord | null> {
  const e = escopoDe(exerciseId, clienteId);
  const key = videoKey(e);
  const atual = await withStore<PersonalVideoRecord | null>('readonly', (store, done) => {
    store.get(key).onsuccess = (ev) => {
      done((ev.target as IDBRequest<PersonalVideoRecord | undefined>).result ?? null);
    };
  });
  const legado = legacyKey(e);
  if (atual || !legado) return atual;

  return withStore<PersonalVideoRecord | null>('readwrite', (store, done) => {
    store.get(key).onsuccess = (ev) => {
      const ja = (ev.target as IDBRequest<PersonalVideoRecord | undefined>).result;
      if (ja) return done(ja);
      store.get(legado).onsuccess = (ev2) => {
        const old = (ev2.target as IDBRequest<PersonalVideoRecord | undefined>).result;
        if (!legadoConfere(old, e)) return done(null);
        const novo = novoRegistro(e, old.blob, old);
        store.put(novo);
        store.delete(legado);
        done(novo);
      };
    };
  });
}

/** Remove o vídeo pessoal deste (dono, cliente, exercício) — inclusive a cópia legada. */
export async function deletePersonalVideo(exerciseId: string, clienteId?: string | null): Promise<void> {
  const e = escopoDe(exerciseId, clienteId);
  const legado = legacyKey(e);
  return withStore<void>('readwrite', (store, done) => {
    store.delete(videoKey(e));
    if (legado) {
      store.get(legado).onsuccess = (ev) => {
        if (legadoConfere((ev.target as IDBRequest<PersonalVideoRecord | undefined>).result, e)) store.delete(legado);
      };
    }
    done();
  });
}

/** Chaves (sem carregar blobs) que satisfazem `filtro`. */
function chaves(store: IDBObjectStore, filtro: (key: string) => boolean, cb: (keys: string[]) => void): void {
  store.getAllKeys().onsuccess = (ev) => {
    cb((ev.target as IDBRequest<IDBValidKey[]>).result.map(String).filter(filtro));
  };
}

/** Chave NOVA do dono atual para o exercício (qualquer cliente): `owner:escopo:exercicio:video`. */
function novaDoExercicio(key: string, owner: string, exerciseId: string): boolean {
  const p = key.split(':');
  return p.length === 4 && p[0] === owner && p[2] === encodeURIComponent(exerciseId);
}

/** Chave LEGADA (por e-mail) do exercício, em qualquer escopo. */
function legadaDoExercicio(key: string, email: string | null, exerciseId: string): boolean {
  return !!email && (key === `${email}_${exerciseId}` || (key.startsWith(`${email}:`) && key.endsWith(`:${exerciseId}`)));
}

/** Quantos vídeos DESTE dono existem para o exercício (todos os clientes). */
export async function countPersonalVideosByExercise(exerciseId: string): Promise<number> {
  const owner = donoOwner();
  const email = getLocalAuthEmail();
  if (!idOk(exerciseId)) return 0;
  return withStore<number>('readonly', (store, done) => {
    chaves(store, (k) => novaDoExercicio(k, owner, exerciseId) || legadaDoExercicio(k, email, exerciseId), (keys) => done(keys.length));
  });
}

/** Remove os vídeos DESTE dono de um exercício (exercício removido do banco). Nunca toca em outro dono. */
export async function deletePersonalVideosByExercise(exerciseId: string): Promise<void> {
  const owner = donoOwner();
  const email = getLocalAuthEmail();
  if (!idOk(exerciseId)) return;
  return withStore<void>('readwrite', (store, done) => {
    chaves(store, (k) => novaDoExercicio(k, owner, exerciseId) || legadaDoExercicio(k, email, exerciseId), (keys) => {
      keys.forEach((k) => store.delete(k));
      done();
    });
  });
}

/** Remove os vídeos DESTE dono gravados na sessão de um aluno (aluno removido da lista). */
export async function deletePersonalVideosByCliente(clienteId: string): Promise<void> {
  const owner = donoOwner();
  const email = getLocalAuthEmail();
  if (!idOk(clienteId)) return;
  const novo = `${owner}:${segmento(clienteId)}:`;
  const velho = email ? `${email}:${clienteId}:` : null;
  return withStore<void>('readwrite', (store, done) => {
    chaves(store, (k) => k.startsWith(novo) || (!!velho && k.startsWith(velho)), (keys) => {
      keys.forEach((k) => store.delete(k));
      done();
    });
  });
}
