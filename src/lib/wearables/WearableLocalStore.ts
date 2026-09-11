/**
 * Armazenamento local do histórico de wearables — IndexedDB puro (mesmo
 * padrão de src/lib/localVideoStore.ts, sem libs novas). ZERO Firebase:
 * nenhuma função deste arquivo fala com rede; dado de saúde nunca sai
 * daqui além de sair de volta pra tela que pediu.
 *
 * Três object stores num único banco:
 * - 'records'    → WearableSyncRecord por id determinístico (dedup real:
 *                  put() com mesmo id nunca duplica, só sobrescreve com
 *                  o mesmo conteúdo — idempotência).
 * - 'cursors'    → SyncCursor por escopo (WearableScope).
 * - 'retryQueue' → SyncRetryEntry por id — escopos que falharam e
 *                  precisam ser retentados (offline-first).
 *
 * Nada aqui lança pra fora sem necessidade: toda operação de leitura
 * falha graciosamente (retorna vazio/null) se IndexedDB não existir
 * (SSR, ambiente de teste sem polyfill) — quem decide o que fazer com
 * isso é a camada de cima (WearableService).
 */

import type { SyncCursor, SyncRetryEntry, WearableScope, WearableSyncRecord } from './models';
import { warnDev } from './devLog';
import { decryptPayload, encryptPayload, isEncryptedPayload } from './secureStorage';

/** Teto de amostras retornadas por consulta pro escopo de FC (o único
 *  realmente contínuo/alta-frequência aqui) — protege qualquer consumidor
 *  atual ou futuro de carregar centenas de milhares de pontos de uma vez
 *  na memória. Downsample uniforme, não corta o intervalo, só a densidade. */
const MAX_HEART_RATE_POINTS = 2000;

function downsampleUniform<T>(items: T[], maxPoints: number): T[] {
  if (items.length <= maxPoints) return items;
  const step = items.length / maxPoints;
  const out: T[] = [];
  for (let i = 0; i < maxPoints; i++) out.push(items[Math.floor(i * step)]);
  return out;
}

const DB_NAME = 'volumfocus-wearables';
const DB_VERSION = 1;
const STORE_RECORDS = 'records';
const STORE_CURSORS = 'cursors';
const STORE_RETRY_QUEUE = 'retryQueue';

export function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error('IndexedDB indisponível neste ambiente'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_RECORDS)) {
          const store = db.createObjectStore(STORE_RECORDS, { keyPath: 'id' });
          store.createIndex('by_type_timestamp', ['type', 'timestamp']);
        }
        if (!db.objectStoreNames.contains(STORE_CURSORS)) {
          db.createObjectStore(STORE_CURSORS, { keyPath: 'scope' });
        }
        if (!db.objectStoreNames.contains(STORE_RETRY_QUEUE)) {
          db.createObjectStore(STORE_RETRY_QUEUE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Falha ao abrir IndexedDB de wearables'));
    });
  }
  return dbPromise;
}

function runTx<T>(storeName: string, mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const req = work(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error(`Falha na transação em ${storeName}`));
      })
  );
}

/** Grava um lote de registros já normalizados. Cada `put` é idempotente
 *  pelo id determinístico — reexecutar o mesmo sync não duplica nada.
 *  Processa em fatias pequenas cedendo o event loop entre elas, pra não
 *  travar a UI numa agregação grande (histórico de meses, por exemplo). */
export async function putRecords(records: WearableSyncRecord[]): Promise<number> {
  if (records.length === 0) return 0;
  const CHUNK = 200;
  let written = 0;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    // `payload` (o dado de saúde em si) é cifrado antes de entrar na
    // transação — id/type/timestamp continuam em texto plano (servem de
    // índice pra by_type_timestamp).
    const encryptedChunk = await Promise.all(
      chunk.map(async (record) => ({ ...record, payload: await encryptPayload(record.payload) }))
    );
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_RECORDS, 'readwrite');
      const store = tx.objectStore(STORE_RECORDS);
      for (const record of encryptedChunk) store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Falha ao gravar registros de wearable'));
    });
    written += chunk.length;
    // Cede a thread principal entre lotes — mantém a UI a 60 FPS mesmo
    // processando um histórico grande.
    if (i + CHUNK < records.length) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  return written;
}

export async function getRecordsInRange(
  type: WearableScope,
  range: { start: Date; end: Date }
): Promise<WearableSyncRecord[]> {
  try {
    const db = await openDb();
    const raw = await new Promise<WearableSyncRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_RECORDS, 'readonly');
      const index = tx.objectStore(STORE_RECORDS).index('by_type_timestamp');
      const lower = [type, range.start.toISOString()];
      const upper = [type, range.end.toISOString()];
      const results: WearableSyncRecord[] = [];
      const req = index.openCursor(IDBKeyRange.bound(lower, upper));
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          results.push(cursor.value as WearableSyncRecord);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      req.onerror = () => reject(req.error ?? new Error('Falha ao ler histórico local de wearable'));
    });

    // Compatível com registros antigos gravados antes da criptografia em
    // repouso (payload em texto plano) — só decifra o que veio cifrado.
    const decrypted = await Promise.all(
      raw.map(async (r) => (isEncryptedPayload(r.payload) ? { ...r, payload: await decryptPayload(r.payload) } : r))
    );

    // FC é o único escopo realmente contínuo/alta-frequência — downsample
    // uniforme protege contra arrays de centenas de milhares de pontos.
    return type === 'heartRate' ? downsampleUniform(decrypted, MAX_HEART_RATE_POINTS) : decrypted;
  } catch (e) {
    warnDev('WearableLocalStore: getRecordsInRange falhou, retornando vazio', e);
    return [];
  }
}

export async function getCursor(scope: WearableScope): Promise<SyncCursor> {
  try {
    const result = await runTx<{ scope: WearableScope } & SyncCursor | undefined>(STORE_CURSORS, 'readonly', (store) =>
      store.get(scope)
    );
    return result ? { lastSyncAt: result.lastSyncAt, lastSuccessfulSyncAt: result.lastSuccessfulSyncAt } : { lastSyncAt: null, lastSuccessfulSyncAt: null };
  } catch (e) {
    warnDev(`WearableLocalStore: getCursor(${scope}) falhou, tratando como primeiro sync`, e);
    return { lastSyncAt: null, lastSuccessfulSyncAt: null };
  }
}

export async function setCursor(scope: WearableScope, cursor: SyncCursor): Promise<void> {
  try {
    await runTx(STORE_CURSORS, 'readwrite', (store) => store.put({ scope, ...cursor }));
  } catch (e) {
    warnDev(`WearableLocalStore: setCursor(${scope}) falhou`, e);
  }
}

export async function listRetryQueue(): Promise<SyncRetryEntry[]> {
  try {
    return await runTx<SyncRetryEntry[]>(STORE_RETRY_QUEUE, 'readonly', (store) => store.getAll());
  } catch (e) {
    warnDev('WearableLocalStore: listRetryQueue falhou, tratando fila como vazia', e);
    return [];
  }
}

export async function enqueueRetry(entry: SyncRetryEntry): Promise<void> {
  try {
    await runTx(STORE_RETRY_QUEUE, 'readwrite', (store) => store.put(entry));
  } catch (e) {
    warnDev('WearableLocalStore: enqueueRetry falhou', e);
  }
}

export async function dequeueRetry(id: string): Promise<void> {
  try {
    await runTx(STORE_RETRY_QUEUE, 'readwrite', (store) => store.delete(id));
  } catch (e) {
    warnDev('WearableLocalStore: dequeueRetry falhou', e);
  }
}

/** Apaga TODO o histórico local de wearables (registros, cursores e fila).
 *  Usado em logout/troca de usuário no mesmo aparelho — dado de saúde é
 *  local-only, então "sair" precisa realmente esvaziar, não só desligar a
 *  store em memória. */
export async function wipeAll(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_RECORDS, STORE_CURSORS, STORE_RETRY_QUEUE], 'readwrite');
      tx.objectStore(STORE_RECORDS).clear();
      tx.objectStore(STORE_CURSORS).clear();
      tx.objectStore(STORE_RETRY_QUEUE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Falha ao limpar dados locais de wearable'));
    });
  } catch (e) {
    warnDev('WearableLocalStore: wipeAll falhou', e);
  }
}

/** Só pra testes — força reabertura do banco entre casos. */
export function resetLocalStoreConnection(): void {
  dbPromise = null;
}
