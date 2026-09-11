/**
 * Criptografia em repouso pro payload de cada WearableSyncRecord (FC,
 * passos, distância, calorias, sessões) guardado em IndexedDB por
 * WearableLocalStore. Não existe SecureStore/EncryptedStorage nativo nesta
 * stack (PWA + Capacitor, não React Native) — o equivalente correto pra
 * web é Web Crypto API (AES-GCM) com a chave simétrica guardada como
 * `CryptoKey` não-extraível dentro do próprio IndexedDB (banco separado):
 * a chave nunca é serializada como string nem exportável pra JS, só o
 * browser consegue usá-la via `crypto.subtle`.
 *
 * `id`, `type`/`scope` e `timestamp` continuam em texto plano (servem de
 * índice pras queries por intervalo); só `payload` — o dado de saúde em
 * si — é cifrado.
 */

const KEY_DB_NAME = 'jg3_wearable_keys';
const KEY_STORE = 'keys';
const KEY_ID = 'payload-key';

let cachedKey: CryptoKey | null = null;

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KEY_DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(KEY_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadStoredKey(): Promise<CryptoKey | null> {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readonly');
    const req = tx.objectStore(KEY_STORE).get(KEY_ID);
    req.onsuccess = () => resolve((req.result as CryptoKey) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function persistKey(key: CryptoKey): Promise<void> {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readwrite');
    tx.objectStore(KEY_STORE).put(key, KEY_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Chave AES-256-GCM não-extraível, gerada uma vez por dispositivo e
 *  persistida como objeto `CryptoKey` (nunca como bytes/base64) no
 *  IndexedDB. Repetir a leitura sempre traz a mesma chave; sem ela os
 *  registros antigos simplesmente não decifram (nunca ficam em texto
 *  plano por engano). */
async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const existing = await loadStoredKey();
  if (existing) {
    cachedKey = existing;
    return existing;
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await persistKey(key);
  cachedKey = key;
  return key;
}

export interface EncryptedPayload {
  __enc: true;
  iv: number[];
  data: number[];
}

export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  return !!value && typeof value === 'object' && (value as EncryptedPayload).__enc === true;
}

export async function encryptPayload(payload: unknown): Promise<EncryptedPayload> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  return { __enc: true, iv: Array.from(iv), data: Array.from(new Uint8Array(cipher)) };
}

export async function decryptPayload<T>(enc: EncryptedPayload): Promise<T> {
  const key = await getKey();
  const iv = new Uint8Array(enc.iv);
  const cipherBytes = new Uint8Array(enc.data);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes);
  return JSON.parse(new TextDecoder().decode(plainBuf)) as T;
}
