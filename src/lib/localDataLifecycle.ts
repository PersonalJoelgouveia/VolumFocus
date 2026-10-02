import { LOCAL_STORAGE_KEYS } from './backupRepository';
import { limparTodosRascunhosOnline } from './onlineAssessmentDraftStore';
import { OWNER_KEY, clearLocalOwnerMemory, setLocalOwner } from './localOwner';

/**
 * Ciclo de vida dos dados locais (P1 da auditoria de segurança).
 *
 * 1. DONO: `jg3_owner` guarda o uid da conta a quem pertence tudo o que
 *    está no navegador. Se outra conta autorizada entrar, os dados locais
 *    da anterior são removidos (ver useAuthStore) em vez de herdados — ou
 *    enviados ao backup da conta nova.
 * 2. LIMPEZA: o logout apagava só `LOCAL_STORAGE_KEYS`; sobravam rascunhos,
 *    sessões presenciais (nomes de clientes), estados de saúde/wearable e
 *    os bancos IndexedDB.
 * 3. MÍDIA LOCAL (fotos de avaliação e vídeos) é tratada à parte: existe
 *    SÓ neste aparelho (nunca vai ao Firebase), então apagá-la é perda
 *    definitiva. Quem decide é o usuário (ver `hasLocalMedia`).
 *
 * Fica de fora de propósito (preferências/ferramentas sem dado de
 * cliente): jg3_theme, jg3_locale, jg3_timer_audio_settings,
 * jg3_timer_library, jg3_training_models_v9.
 */

/** Dado de usuário/cliente que não estava em LOCAL_STORAGE_KEYS. */
const EXTRA_USER_KEYS = ['jg3_sessoes_treino', 'jg3_rotina_sync', 'jg3_health_status', 'jg3_wearable_status'];

/** Derivado do aparelho de saúde (re-sincronizável) + a chave que o cifra. */
const WEARABLE_DBS = ['volumfocus-wearables', 'jg3_wearable_keys'];

/** Só existem neste aparelho — perda irreversível se apagados. */
const MEDIA_DBS = ['volumfocus-assessment-media', 'volumfocus-media'];

/** Nunca deixa o logout travar por causa de um IndexedDB que não responde. */
const IDB_TIMEOUT_MS = 3000;

export type OwnerCheck = 'same' | 'adopted' | 'mismatch';

/**
 * Compara o dono registrado com a conta que acabou de entrar.
 * - sem dono registrado (primeiro uso ou instalação anterior a este
 *   controle): adota a conta atual, sem apagar nada (evita perder dados
 *   de quem já usa o app);
 * - dono diferente: `mismatch` — quem chamou deve limpar e recarregar.
 */
export function enforceLocalOwner(uid: string): OwnerCheck {
  try {
    const current = localStorage.getItem(OWNER_KEY);
    if (current === uid) {
      setLocalOwner(uid);
      return 'same';
    }
    if (!current) {
      setLocalOwner(uid);
      return 'adopted';
    }
    return 'mismatch';
  } catch {
    setLocalOwner(uid); // localStorage indisponível: o dono vale só em memória
    return 'same';
  }
}

interface OpenResult {
  db: IDBDatabase | null;
  /** false = falha real ao abrir (≠ banco inexistente). */
  ok: boolean;
}

/** Abre um banco SÓ se já existir (não cria banco vazio por acidente). */
function openExisting(name: string): Promise<OpenResult> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve({ db: null, ok: true });
    let settled = false;
    let absent = false;
    const finish = (r: OpenResult) => {
      if (settled) {
        r.db?.close(); // resposta tardia (depois do timeout) — não vaza conexão
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(r);
    };
    const timer = setTimeout(() => finish({ db: null, ok: false }), IDB_TIMEOUT_MS);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(name);
    } catch {
      return finish({ db: null, ok: false });
    }
    req.onupgradeneeded = () => {
      absent = true; // o banco não existia: aborta para não criá-lo vazio
      try {
        req.transaction?.abort();
      } catch {
        /* nada a fazer */
      }
    };
    req.onerror = () => finish({ db: null, ok: absent });
    req.onsuccess = () => finish({ db: req.result, ok: true });
  });
}

/** Esvazia todos os object stores (não é bloqueado por outras conexões abertas). */
async function clearDb(name: string): Promise<boolean> {
  const { db, ok } = await openExisting(name);
  if (!db) return ok;
  try {
    const stores = Array.from(db.objectStoreNames);
    if (stores.length === 0) return true;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(stores, 'readwrite');
      stores.forEach((s) => tx.objectStore(s).clear());
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('transação abortada'));
    });
    return true;
  } catch (e) {
    console.error(`localDataLifecycle: falha ao limpar ${name}`, e);
    return false;
  } finally {
    db.close();
  }
}

async function dbHasRecords(name: string): Promise<boolean> {
  const { db } = await openExisting(name);
  if (!db) return false;
  try {
    const stores = Array.from(db.objectStoreNames);
    if (stores.length === 0) return false;
    const counts = await Promise.all(
      stores.map(
        (s) =>
          new Promise<number>((resolve) => {
            const req = db.transaction(s, 'readonly').objectStore(s).count();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(0);
          })
      )
    );
    return counts.some((n) => n > 0);
  } catch {
    return false;
  } finally {
    db.close();
  }
}

/** Há fotos de avaliação ou vídeos gravados neste aparelho? */
export async function hasLocalMedia(): Promise<boolean> {
  const found = await Promise.all(MEDIA_DBS.map(dbHasRecords));
  return found.some(Boolean);
}

/**
 * Apaga os dados locais da conta (localStorage + rascunhos + IndexedDB de
 * wearables). `includeMedia` também apaga fotos e vídeos — irreversível.
 * Retorna `false` se algo não pôde ser limpo (o chamador deve avisar).
 */
export async function wipeLocalData({ includeMedia }: { includeMedia: boolean }): Promise<boolean> {
  let ok = true;
  try {
    clearLocalOwnerMemory();
    [...LOCAL_STORAGE_KEYS, ...EXTRA_USER_KEYS, OWNER_KEY].forEach((k) => localStorage.removeItem(k));
    limparTodosRascunhosOnline();
  } catch (e) {
    console.error('localDataLifecycle: falha ao limpar localStorage', e);
    ok = false;
  }
  const dbs = includeMedia ? [...WEARABLE_DBS, ...MEDIA_DBS] : WEARABLE_DBS;
  const results = await Promise.all(dbs.map(clearDb));
  return ok && results.every(Boolean);
}
