/**
 * Vídeo pessoal do exercício — armazenado EXCLUSIVAMENTE no dispositivo
 * via IndexedDB (Blob nativo, nunca Base64/localStorage, nunca upload
 * pro Firebase/Storage). Diferente das imagens de execução e do vídeo
 * do YouTube (ambos gerenciados pelo Personal, compartilhados via
 * Firestore/Storage — ver lib/exerciseMediaRepository.ts), este é o
 * registro PESSOAL de quem está treinando, só para referência própria
 * naquele aparelho.
 *
 * CHAVE (namespace — o IndexedDB é isolado por origem, não por usuário):
 *   sem cliente : `${email}_${exerciseId}`            (formato original, sem migração)
 *   com cliente : `${email}:${clienteId}:${exerciseId}` (aba de sessão de um aluno)
 * O e-mail escopa por usuário: dois logins no mesmo aparelho nunca montam a
 * mesma chave, e não existe função que liste/enumere vídeos de outro e-mail.
 * `clienteId` (id LOCAL do aluno) escopa por cliente quando um Personal grava
 * dentro da sessão de um aluno — assim o vídeo do Cliente A não aparece na
 * sessão do Cliente B. Os formatos não colidem: o novo tem ':' e o antigo não.
 *
 * LIMPEZA: sem varredura heurística — o vídeo é cópia única. Só se apaga o
 * que se PROVA órfão: remoção explícita do vídeo, do exercício ou do aluno.
 */

import { getFreeStorageBytes, requestPersistentStorage } from './storageQuota';

const DB_NAME = 'volumfocus-media';
const DB_VERSION = 1;
const STORE_NAME = 'personal-videos';

export interface PersonalVideoRecord {
  id: string;
  exerciseId: string;
  userEmail: string;
  /** Presente quando gravado dentro da sessão de um aluno. */
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

function videoKey(userEmail: string, exerciseId: string, clienteId?: string | null): string {
  const email = userEmail.toLowerCase();
  return clienteId ? `${email}:${clienteId}:${exerciseId}` : `${email}_${exerciseId}`;
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

/** Tamanho do vídeo já salvo nessa chave (0 se não houver) — será liberado pela substituição. */
function existingSize(key: string): Promise<number> {
  return withStore<number>('readonly', (store, done) => {
    store.get(key).onsuccess = (ev) => {
      const rec = (ev.target as IDBRequest<PersonalVideoRecord | undefined>).result;
      done(rec?.sizeBytes ?? 0);
    };
  });
}

/**
 * Salva (ou substitui) o vídeo pessoal do exercício — só neste dispositivo.
 * Antes de gravar confere o espaço livre estimado (a substituição devolve o
 * tamanho do vídeo antigo); se não couber, lança `VideoStorageFullError` sem
 * tocar no vídeo existente.
 */
export async function savePersonalVideo(
  userEmail: string,
  exerciseId: string,
  blob: Blob,
  clienteId?: string | null
): Promise<void> {
  const id = videoKey(userEmail, exerciseId, clienteId);

  const livre = await getFreeStorageBytes();
  if (livre !== null && blob.size > livre + (await existingSize(id))) {
    throw new VideoStorageFullError();
  }

  await withStore<void>('readwrite', (store, done) => {
    const record: PersonalVideoRecord = {
      id,
      exerciseId,
      userEmail: userEmail.toLowerCase(),
      ...(clienteId ? { clienteId } : {}),
      blob,
      mimeType: blob.type || 'video/webm',
      createdAt: new Date().toISOString(),
      sizeBytes: blob.size,
    };
    store.put(record);
    done();
  });

  requestPersistentStorage(); // cópia única: pede para o navegador não descartar
}

/** Busca o vídeo pessoal salvo neste dispositivo — retorna `null` se nunca foi gravado aqui. */
export async function getPersonalVideo(
  userEmail: string,
  exerciseId: string,
  clienteId?: string | null
): Promise<PersonalVideoRecord | null> {
  const key = videoKey(userEmail, exerciseId, clienteId);
  return withStore<PersonalVideoRecord | null>('readonly', (store, done) => {
    store.get(key).onsuccess = (ev) => {
      done((ev.target as IDBRequest<PersonalVideoRecord | undefined>).result ?? null);
    };
  });
}

/** Remove o vídeo pessoal deste dispositivo. */
export async function deletePersonalVideo(
  userEmail: string,
  exerciseId: string,
  clienteId?: string | null
): Promise<void> {
  const key = videoKey(userEmail, exerciseId, clienteId);
  return withStore<void>('readwrite', (store, done) => {
    store.delete(key);
    done();
  });
}

/** Chaves (sem carregar blobs) deste usuário que satisfazem `filtro`. */
function chavesDoUsuario(store: IDBObjectStore, userEmail: string, filtro: (key: string) => boolean, cb: (keys: string[]) => void): void {
  const email = userEmail.toLowerCase();
  store.getAllKeys().onsuccess = (ev) => {
    const todas = (ev.target as IDBRequest<IDBValidKey[]>).result.map(String);
    cb(todas.filter((k) => (k.startsWith(`${email}_`) || k.startsWith(`${email}:`)) && filtro(k)));
  };
}

/** Em qualquer escopo (sem cliente ou de qualquer cliente) o id do exercício é o último trecho. */
function eDoExercicio(key: string, userEmail: string, exerciseId: string): boolean {
  const email = userEmail.toLowerCase();
  return key === `${email}_${exerciseId}` || (key.startsWith(`${email}:`) && key.endsWith(`:${exerciseId}`));
}

/** Quantos vídeos deste usuário existem para o exercício (todos os escopos). */
export async function countPersonalVideosByExercise(userEmail: string, exerciseId: string): Promise<number> {
  return withStore<number>('readonly', (store, done) => {
    chavesDoUsuario(store, userEmail, (k) => eDoExercicio(k, userEmail, exerciseId), (keys) => done(keys.length));
  });
}

/** Remove os vídeos deste usuário de um exercício (exercício removido do banco). Nunca toca em outro e-mail. */
export async function deletePersonalVideosByExercise(userEmail: string, exerciseId: string): Promise<void> {
  return withStore<void>('readwrite', (store, done) => {
    chavesDoUsuario(store, userEmail, (k) => eDoExercicio(k, userEmail, exerciseId), (keys) => {
      keys.forEach((k) => store.delete(k));
      done();
    });
  });
}

/** Remove os vídeos deste usuário gravados na sessão de um aluno (aluno removido da lista). */
export async function deletePersonalVideosByCliente(userEmail: string, clienteId: string): Promise<void> {
  const prefixo = `${userEmail.toLowerCase()}:${clienteId}:`;
  return withStore<void>('readwrite', (store, done) => {
    chavesDoUsuario(store, userEmail, (k) => k.startsWith(prefixo), (keys) => {
      keys.forEach((k) => store.delete(k));
      done();
    });
  });
}
