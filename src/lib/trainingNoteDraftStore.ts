/**
 * Draft local de uma Anotação em edição — armazenado EXCLUSIVAMENTE no
 * dispositivo via IndexedDB, mesmo padrão de lib/assessmentPhotoStore.ts.
 * Existe só pra recuperação em caso de falha de rede durante o autosave:
 * a cada tecla (debounced) o conteúdo grava aqui antes/junto de tentar
 * subir pro Firestore; se a subida falhar, o draft continua disponível
 * pra reabrir e tentar de novo sem perder o que foi digitado.
 *
 * Banco PRÓPRIO (`volumfocus-training-notes`), separado do
 * `volumfocus-assessment-media` e do `volumfocus-media` — dois arquivos
 * independentes controlando o `DB_VERSION` do MESMO banco é frágil.
 */

const DB_NAME = 'volumfocus-training-notes';
const DB_VERSION = 1;
const STORE_NAME = 'note-drafts';

export interface NoteDraft {
  noteId: string;
  conteudo: string;
  updatedAt: string;
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
        db.createObjectStore(STORE_NAME, { keyPath: 'noteId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Falha ao abrir IndexedDB'));
  });
}

/** Salva (ou substitui) o draft local desta anotação. Nunca lança pro
 *  chamador — falha de draft local não pode travar o autosave em si (quem
 *  chama decide se avisa o usuário via status "Erro ao salvar"). */
export async function saveDraft(noteId: string, conteudo: string): Promise<void> {
  try {
    const db = await openDb();
    const draft: NoteDraft = { noteId, conteudo, updatedAt: new Date().toISOString() };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(draft);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Falha ao salvar draft'));
    });
  } catch (e) {
    console.error('trainingNoteDraftStore: falha ao salvar draft local', e);
  }
}

/** Lê o draft local desta anotação, ou `null` se não existir/indisponível. */
export async function getDraft(noteId: string): Promise<NoteDraft | null> {
  try {
    const db = await openDb();
    return await new Promise<NoteDraft | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(noteId);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error ?? new Error('Falha ao ler draft'));
    });
  } catch (e) {
    console.error('trainingNoteDraftStore: falha ao ler draft local', e);
    return null;
  }
}

/** Remove o draft local — chamado após confirmar que o Firestore já tem o conteúdo mais recente. */
export async function deleteDraft(noteId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(noteId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Falha ao remover draft'));
    });
  } catch (e) {
    console.error('trainingNoteDraftStore: falha ao remover draft local', e);
  }
}
