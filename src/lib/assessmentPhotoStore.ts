/**
 * Fotos comparativas da Avaliação Física — armazenadas EXCLUSIVAMENTE no
 * dispositivo via IndexedDB (Blob nativo). NUNCA Base64, NUNCA Firestore
 * (documentos com blob/base64 pesado estouram o limite de 1MiB do
 * Firestore e encarecem leitura/escrita à toa) — a arquitetura já deixa a
 * porta aberta pra sincronização em nuvem futura (ver `PhotoMetadata`,
 * pensado pra virar referência de um objeto no Storage mais adiante).
 *
 * Banco PRÓPRIO (`volumfocus-assessment-media`), separado do
 * `volumfocus-media` que lib/localVideoStore.ts já usa — mesmo essa etapa
 * usando o "gerenciador de mídia local existente" como referência de
 * padrão, dois arquivos independentes controlando o `DB_VERSION` do MESMO
 * banco é frágil (upgrade de um quebra o open() hardcoded do outro).
 * Isolamento aqui é deliberado, não descuido.
 */

const DB_NAME = 'volumfocus-assessment-media';
const DB_VERSION = 1;
const STORE_NAME = 'assessment-photos';
const INDEX_ASSESSMENT = 'assessmentId';

export type PhotoPose = 'front' | 'back' | 'rightSide' | 'leftSide';

export const PHOTO_POSES: PhotoPose[] = ['front', 'back', 'rightSide', 'leftSide'];

/** Referências (não os blobs) das 4 poses de uma avaliação — cada campo é
 *  o `id` do registro em IndexedDB, não a imagem em si. */
export interface AssessmentPhotos {
  assessmentId: string;
  front?: string;
  back?: string;
  rightSide?: string;
  leftSide?: string;
}

export interface PhotoMetadata {
  id: string;
  assessmentId: string;
  /** Não estava no modelo original, mas o pedido também exige vínculo com
   *  alunoId — adicionado aqui (e indexado) pra listar fotos por aluno
   *  sem precisar cruzar cada assessmentId de volta pro aluno dono. */
  alunoId: string;
  pose: PhotoPose;
  createdAt: string;
  mimeType: string;
  width: number;
  height: number;
}

interface PhotoRecord extends PhotoMetadata {
  blob: Blob;
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
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex(INDEX_ASSESSMENT, 'assessmentId', { unique: false });
        store.createIndex('alunoId', 'alunoId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Falha ao abrir IndexedDB'));
  });
}

/** Uma avaliação tem no máximo 1 foto por pose — a chave já garante isso (put substitui). */
function photoId(assessmentId: string, pose: PhotoPose): string {
  return `${assessmentId}_${pose}`;
}

/** Salva (ou substitui) a foto daquela pose — só neste dispositivo. */
export async function savePhoto(
  alunoId: string,
  assessmentId: string,
  pose: PhotoPose,
  blob: Blob,
  dimensoes: { width: number; height: number }
): Promise<PhotoMetadata> {
  const db = await openDb();
  const metadata: PhotoMetadata = {
    id: photoId(assessmentId, pose),
    assessmentId,
    alunoId,
    pose,
    createdAt: new Date().toISOString(),
    mimeType: blob.type || 'image/jpeg',
    width: dimensoes.width,
    height: dimensoes.height,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const record: PhotoRecord = { ...metadata, blob };
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve(metadata);
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao salvar foto'));
  });
}

/** Registro completo (metadados + blob) de uma pose específica, ou `null` se não capturada. */
export async function getPhoto(assessmentId: string, pose: PhotoPose): Promise<PhotoRecord | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(photoId(assessmentId, pose));
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error ?? new Error('Falha ao ler foto'));
  });
}

/** As referências das 4 poses de uma avaliação, via índice (sem varrer o store todo). */
export async function getPhotosByAssessment(assessmentId: string): Promise<AssessmentPhotos> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).index(INDEX_ASSESSMENT).getAll(assessmentId);
    req.onsuccess = () => {
      const registros = (req.result ?? []) as PhotoRecord[];
      const resultado: AssessmentPhotos = { assessmentId };
      for (const r of registros) resultado[r.pose] = r.id;
      resolve(resultado);
    };
    req.onerror = () => reject(req.error ?? new Error('Falha ao listar fotos'));
  });
}

/** Remove a foto daquela pose deste dispositivo. */
export async function deletePhoto(assessmentId: string, pose: PhotoPose): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(photoId(assessmentId, pose));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao remover foto'));
  });
}

/** URL local (`createObjectURL`) pra exibir a foto — quem chama deve `revokeObjectURL` depois de usar. */
export async function getPhotoObjectUrl(assessmentId: string, pose: PhotoPose): Promise<string | null> {
  const registro = await getPhoto(assessmentId, pose);
  return registro ? URL.createObjectURL(registro.blob) : null;
}
