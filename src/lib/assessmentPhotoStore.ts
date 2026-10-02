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
 *
 * NAMESPACE POR DONO: o IndexedDB é isolado por ORIGEM, não por usuário —
 * duas contas no mesmo navegador compartilham o banco. Por isso o `id` de
 * cada registro é `${uid}:${assessmentId}_${pose}`, onde `uid` é o dono
 * local (ver localOwner.ts). Uma conta nunca lê, sobrescreve nem apaga a
 * foto de outra, mesmo que ambas conheçam o mesmo `assessmentId` (ex.: o
 * mesmo aluno visto por dois Personals, ou pelo próprio aluno).
 *
 * LEGADO: registros antigos têm `id = ${assessmentId}_${pose}` (sem
 * ':'). São "adotados" — movidos para o namespace de quem os acessa — no
 * primeiro acesso por assessmentId. Nunca são apagados por heurística:
 * as fotos só existem neste aparelho, então só se apaga o que se PROVA
 * órfão (exclusão explícita, avaliação nova cancelada, rascunho vencido).
 */

import { getLocalOwner } from './localOwner';

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
  /** uid do dono local. Ausente em registros anteriores ao namespace. */
  ownerUid?: string;
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

/** Dono local atual. Sem conta autenticada não há foto acessível (falha segura). */
function currentOwner(): string {
  const uid = getLocalOwner();
  if (!uid) throw new Error('Fotos indisponíveis: nenhuma conta autenticada neste dispositivo');
  return uid;
}

/** Uma avaliação tem no máximo 1 foto por pose POR DONO — a chave já garante isso (put substitui). */
function photoId(owner: string, assessmentId: string, pose: PhotoPose): string {
  return `${owner}:${assessmentId}_${pose}`;
}

/** Formato anterior ao namespace (sem dono). */
function legacyPhotoId(assessmentId: string, pose: PhotoPose): string {
  return `${assessmentId}_${pose}`;
}

/**
 * Abre o banco, roda UMA transação e FECHA a conexão ao terminar (antes as
 * conexões ficavam abertas para sempre). `work` registra o resultado via `done`.
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
          reject(tx.error ?? new Error('Falha na operação de fotos'));
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error ?? new Error('Operação de fotos abortada'));
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

/** Move um registro legado para o namespace do dono (mesma transação: tudo ou nada). */
function adoptLegacy(store: IDBObjectStore, owner: string, legado: PhotoRecord, pose: PhotoPose): PhotoRecord {
  const adotado: PhotoRecord = { ...legado, id: photoId(owner, legado.assessmentId, pose), ownerUid: owner };
  store.put(adotado);
  store.delete(legado.id);
  return adotado;
}

/** Salva (ou substitui) a foto daquela pose — só neste dispositivo, no namespace do dono atual. */
export async function savePhoto(
  alunoId: string,
  assessmentId: string,
  pose: PhotoPose,
  blob: Blob,
  dimensoes: { width: number; height: number }
): Promise<PhotoMetadata> {
  const owner = currentOwner();
  const metadata: PhotoMetadata = {
    id: photoId(owner, assessmentId, pose),
    assessmentId,
    alunoId,
    ownerUid: owner,
    pose,
    createdAt: new Date().toISOString(),
    mimeType: blob.type || 'image/jpeg',
    width: dimensoes.width,
    height: dimensoes.height,
  };
  return withStore<PhotoMetadata>('readwrite', (store, done) => {
    const record: PhotoRecord = { ...metadata, blob };
    store.put(record);
    store.delete(legacyPhotoId(assessmentId, pose)); // evita reaparecer/adotar uma versão antiga
    done(metadata);
  });
}

/** Registro completo (metadados + blob) de uma pose específica, ou `null` se não capturada. */
export async function getPhoto(assessmentId: string, pose: PhotoPose): Promise<PhotoRecord | null> {
  const owner = currentOwner();
  return withStore<PhotoRecord | null>('readwrite', (store, done) => {
    store.get(photoId(owner, assessmentId, pose)).onsuccess = (ev) => {
      const proprio = (ev.target as IDBRequest<PhotoRecord | undefined>).result;
      if (proprio) return done(proprio);
      store.get(legacyPhotoId(assessmentId, pose)).onsuccess = (ev2) => {
        const legado = (ev2.target as IDBRequest<PhotoRecord | undefined>).result;
        done(legado ? adoptLegacy(store, owner, legado, pose) : null);
      };
    };
  });
}

/** As referências das 4 poses de uma avaliação DO DONO ATUAL, via índice (sem varrer o store todo). */
export async function getPhotosByAssessment(assessmentId: string): Promise<AssessmentPhotos> {
  const owner = currentOwner();
  return withStore<AssessmentPhotos>('readwrite', (store, done) => {
    store.index(INDEX_ASSESSMENT).getAllKeys(assessmentId).onsuccess = (ev) => {
      const chaves = new Set((ev.target as IDBRequest<IDBValidKey[]>).result.map(String));
      const resultado: AssessmentPhotos = { assessmentId };
      for (const pose of PHOTO_POSES) {
        const proprio = photoId(owner, assessmentId, pose);
        if (chaves.has(proprio)) {
          resultado[pose] = proprio;
        } else if (chaves.has(legacyPhotoId(assessmentId, pose))) {
          // Legado: adota no primeiro acesso (get + put/delete na mesma transação).
          store.get(legacyPhotoId(assessmentId, pose)).onsuccess = (ev2) => {
            const legado = (ev2.target as IDBRequest<PhotoRecord | undefined>).result;
            if (legado) resultado[pose] = adoptLegacy(store, owner, legado, pose).id;
          };
        }
      }
      done(resultado);
    };
  });
}

/** Remove a foto daquela pose (do dono atual, e a cópia legada, se ainda existir). */
export async function deletePhoto(assessmentId: string, pose: PhotoPose): Promise<void> {
  const owner = currentOwner();
  return withStore<void>('readwrite', (store, done) => {
    store.delete(photoId(owner, assessmentId, pose));
    store.delete(legacyPhotoId(assessmentId, pose));
    done();
  });
}

/** Remove TODAS as fotos de uma avaliação (exclusão da avaliação / avaliação nova cancelada / rascunho vencido). */
export async function deletePhotosByAssessment(assessmentId: string): Promise<void> {
  const owner = currentOwner();
  return withStore<void>('readwrite', (store, done) => {
    for (const pose of PHOTO_POSES) {
      store.delete(photoId(owner, assessmentId, pose));
      store.delete(legacyPhotoId(assessmentId, pose));
    }
    done();
  });
}

/** Remove todas as fotos de um aluno (dono atual + legado sem dono). `alunoId` é o id LOCAL do aluno. */
export async function deletePhotosByAluno(alunoId: string): Promise<void> {
  const owner = currentOwner();
  const prefixo = `${owner}:`;
  return withStore<void>('readwrite', (store, done) => {
    store.index('alunoId').getAllKeys(alunoId).onsuccess = (ev) => {
      for (const chave of (ev.target as IDBRequest<IDBValidKey[]>).result) {
        const id = String(chave);
        // Só do dono atual ou legado (sem ':'); nunca o namespace de outra conta.
        if (id.startsWith(prefixo) || !id.includes(':')) store.delete(chave);
      }
      done();
    };
  });
}

/** URL local (`createObjectURL`) pra exibir a foto — quem chama deve `revokeObjectURL` depois de usar. */
export async function getPhotoObjectUrl(assessmentId: string, pose: PhotoPose): Promise<string | null> {
  const registro = await getPhoto(assessmentId, pose);
  return registro ? URL.createObjectURL(registro.blob) : null;
}
