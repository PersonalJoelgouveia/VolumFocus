/**
 * Vídeo pessoal do exercício — armazenado EXCLUSIVAMENTE no dispositivo
 * via IndexedDB (Blob nativo, nunca Base64/localStorage, nunca upload
 * pro Firebase/Storage). Diferente das imagens de execução e do vídeo
 * do YouTube (ambos gerenciados pelo Personal, compartilhados via
 * Firestore/Storage — ver lib/exerciseMediaRepository.ts), este é o
 * registro PESSOAL de quem está treinando, só para referência própria
 * naquele aparelho.
 *
 * Chave = `${userEmail}_${exerciseId}` — escopado por usuário, não só
 * por exercício, pra dois logins diferentes no mesmo aparelho não verem
 * o vídeo um do outro.
 */

const DB_NAME = 'volumfocus-media';
const DB_VERSION = 1;
const STORE_NAME = 'personal-videos';

export interface PersonalVideoRecord {
  id: string;
  exerciseId: string;
  userEmail: string;
  blob: Blob;
  mimeType: string;
  createdAt: string;
  sizeBytes: number;
}

function videoKey(userEmail: string, exerciseId: string): string {
  return `${userEmail.toLowerCase()}_${exerciseId}`;
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

/** Salva (ou substitui) o vídeo pessoal do exercício — só neste dispositivo. */
export async function savePersonalVideo(userEmail: string, exerciseId: string, blob: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const record: PersonalVideoRecord = {
      id: videoKey(userEmail, exerciseId),
      exerciseId,
      userEmail: userEmail.toLowerCase(),
      blob,
      mimeType: blob.type || 'video/webm',
      createdAt: new Date().toISOString(),
      sizeBytes: blob.size,
    };
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao salvar vídeo'));
  });
}

/** Busca o vídeo pessoal salvo neste dispositivo — retorna `null` se nunca foi gravado aqui. */
export async function getPersonalVideo(userEmail: string, exerciseId: string): Promise<PersonalVideoRecord | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(videoKey(userEmail, exerciseId));
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error ?? new Error('Falha ao ler vídeo'));
  });
}

/** Remove o vídeo pessoal deste dispositivo. */
export async function deletePersonalVideo(userEmail: string, exerciseId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(videoKey(userEmail, exerciseId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao remover vídeo'));
  });
}
