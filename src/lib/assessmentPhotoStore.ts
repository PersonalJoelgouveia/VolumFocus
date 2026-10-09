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
 * NAMESPACE POR OWNERSHIP (isolamento LÓGICO local): o IndexedDB é isolado por
 * ORIGEM, não por usuário nem por cliente — duas contas no mesmo navegador
 * compartilham o banco. Por isso a chave de cada foto é
 *
 *     ${ownerUUID}:${encodeURIComponent(alunoId)}:${assessmentId}:${pose}
 *
 * (dono + cliente + avaliação + foto). Quem tem outro ownerUUID, ou pede outro
 * `alunoId`, simplesmente não encontra o registro: nunca lê, sobrescreve nem
 * apaga a foto alheia, mesmo conhecendo o `assessmentId`. `:` nunca aparece
 * dentro de um componente (ownerUUID é UUID, `alunoId` é codificado e
 * `assessmentId` passa por ID_SEGURO), então as chaves não se confundem.
 *
 * O ownerUUID NÃO é segredo e NÃO autoriza nada: é só o separador de espaços de
 * armazenamento local (vem de localOwner.ts, resolvido pelo vínculo Auth UID →
 * ownerUUID). Os dados no Firestore continuam protegidos pelas Security Rules.
 * Sem sessão autorizada / sem ownerUUID resolvido, nenhuma foto é acessível.
 *
 * LEGADO (cache existente preservado — nada é apagado por heurística):
 *  - L0: `${assessmentId}_${pose}`      (anterior a qualquer namespace)
 *  - L1: `${uid}:${assessmentId}_${pose}` (namespace por uid do Firebase)
 * São "adotados" — movidos para a chave nova, na MESMA transação — no primeiro
 * acesso, e SÓ se o `alunoId` gravado no registro for o do cliente que pede.
 * Mesmo sem esse passo as fotos continuam no aparelho, só não aparecem para
 * quem não é o cliente delas. Só se apaga o que se PROVA órfão (exclusão
 * explícita, avaliação nova cancelada, rascunho vencido, aluno removido);
 * `listarFotosOrfas` apenas LISTA — nunca apaga sozinha.
 */

import { getLocalOwner, getLocalOwnerUUID } from './localOwner';

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
  /** ownerUUID do dono local (namespace atual). Ausente em registros legados até serem adotados. */
  ownerUUID?: string;
  /** uid do Firebase do namespace L1 (anterior ao ownerUUID) — só em registros legados. */
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

/**
 * `assessmentId` vem de fora (campo do documento do Firestore, rascunho local) e entra na
 * CHAVE do banco. Um id com ':' poderia forjar a chave de outro dono (`${uid}:...`) pelo
 * caminho de legado e "adotar" a foto dele. Só formato seguro é aceito; qualquer outro é
 * tratado como "sem foto" (leitura) ou ignorado (exclusão).
 */
const ID_SEGURO = /^[A-Za-z0-9_-]{1,128}$/;

function idValido(assessmentId: string): boolean {
  return typeof assessmentId === 'string' && ID_SEGURO.test(assessmentId);
}

/** `alunoId` também entra na chave: só texto não vazio e de tamanho razoável. */
function alunoValido(alunoId: unknown): alunoId is string {
  return typeof alunoId === 'string' && alunoId.length > 0 && alunoId.length <= 200;
}

/** ownerUUID atual. Sem sessão autorizada/ownerUUID resolvido não há foto acessível (falha segura). */
function currentOwner(): string {
  const owner = getLocalOwnerUUID();
  if (!owner) throw new Error('Fotos indisponíveis: nenhuma conta autenticada/ownerUUID neste dispositivo');
  return owner;
}

/** Escopo de UMA chamada: dono + cliente. Tudo que lê/escreve parte daqui. */
interface Escopo {
  owner: string;
  alunoId: string;
  /** uid do Firebase (namespace L1 legado), se houver. */
  uid: string | null;
}

function escopoDe(alunoId: string): Escopo {
  if (!alunoValido(alunoId)) throw new Error('Identificador de cliente inválido para foto');
  return { owner: currentOwner(), alunoId, uid: getLocalOwner() };
}

function prefixoCliente(e: Escopo): string {
  return `${e.owner}:${encodeURIComponent(e.alunoId)}:`;
}

/** Chave atual: dono + cliente + avaliação + pose. Uma foto por pose POR (dono, cliente) — put substitui. */
function photoId(e: Escopo, assessmentId: string, pose: PhotoPose): string {
  return `${prefixoCliente(e)}${assessmentId}:${pose}`;
}

/** L1: `${uid}:${assessmentId}_${pose}` (namespace por uid, anterior ao ownerUUID). */
function uidPhotoId(uid: string, assessmentId: string, pose: PhotoPose): string {
  return `${uid}:${assessmentId}_${pose}`;
}

/** L0: formato anterior a qualquer namespace (sem dono). */
function legacyPhotoId(assessmentId: string, pose: PhotoPose): string {
  return `${assessmentId}_${pose}`;
}

/** Chaves legadas (L1 do uid atual, depois L0) que PODEM conter a foto desta pose. */
function candidatosLegados(e: Escopo, assessmentId: string, pose: PhotoPose): string[] {
  return [...(e.uid ? [uidPhotoId(e.uid, assessmentId, pose)] : []), legacyPhotoId(assessmentId, pose)];
}

/** O registro legado é deste cliente/avaliação/pose? (impede adotar a foto de outro cliente) */
function ehDesteCliente(r: PhotoRecord | undefined, e: Escopo, assessmentId: string, pose: PhotoPose): r is PhotoRecord {
  return !!r && r.alunoId === e.alunoId && r.assessmentId === assessmentId && r.pose === pose;
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

/** Move um registro legado para a chave atual (mesma transação: tudo ou nada). */
function adotar(store: IDBObjectStore, e: Escopo, legado: PhotoRecord, pose: PhotoPose): PhotoRecord {
  const { ownerUid, ...resto } = legado;
  void ownerUid;
  const adotado: PhotoRecord = { ...resto, id: photoId(e, legado.assessmentId, pose), ownerUUID: e.owner, alunoId: e.alunoId };
  store.put(adotado);
  store.delete(legado.id);
  return adotado;
}

/** Procura a foto da pose entre os candidatos legados e adota o primeiro que for DESTE cliente. */
function adotarPrimeiroLegado(
  store: IDBObjectStore,
  e: Escopo,
  assessmentId: string,
  pose: PhotoPose,
  cb: (adotado: PhotoRecord | null) => void
): void {
  const candidatos = candidatosLegados(e, assessmentId, pose);
  let i = 0;
  const proximo = () => {
    if (i >= candidatos.length) return cb(null);
    store.get(candidatos[i++]).onsuccess = (ev) => {
      const legado = (ev.target as IDBRequest<PhotoRecord | undefined>).result;
      if (ehDesteCliente(legado, e, assessmentId, pose)) return cb(adotar(store, e, legado, pose));
      proximo();
    };
  };
  proximo();
}

/** Apaga as cópias legadas da pose, mas só as que pertencem a ESTE cliente. */
function apagarLegadosDoCliente(store: IDBObjectStore, e: Escopo, assessmentId: string, pose: PhotoPose): void {
  for (const chave of candidatosLegados(e, assessmentId, pose)) {
    store.get(chave).onsuccess = (ev) => {
      const r = (ev.target as IDBRequest<PhotoRecord | undefined>).result;
      if (ehDesteCliente(r, e, assessmentId, pose)) store.delete(chave);
    };
  }
}

/** Salva (ou substitui) a foto daquela pose — só neste dispositivo, no namespace (dono, cliente) atual. */
export async function savePhoto(
  alunoId: string,
  assessmentId: string,
  pose: PhotoPose,
  blob: Blob,
  dimensoes: { width: number; height: number }
): Promise<PhotoMetadata> {
  if (!idValido(assessmentId)) throw new Error('Identificador de avaliação inválido para foto');
  const e = escopoDe(alunoId);
  const metadata: PhotoMetadata = {
    id: photoId(e, assessmentId, pose),
    assessmentId,
    alunoId,
    ownerUUID: e.owner,
    pose,
    createdAt: new Date().toISOString(),
    mimeType: blob.type || 'image/jpeg',
    width: dimensoes.width,
    height: dimensoes.height,
  };
  return withStore<PhotoMetadata>('readwrite', (store, done) => {
    const record: PhotoRecord = { ...metadata, blob };
    store.put(record);
    apagarLegadosDoCliente(store, e, assessmentId, pose); // evita reaparecer/adotar uma versão antiga
    done(metadata);
  });
}

/** Registro completo (metadados + blob) de uma pose do cliente, ou `null` se não houver (ou for de outro dono/cliente). */
export async function getPhoto(alunoId: string, assessmentId: string, pose: PhotoPose): Promise<PhotoRecord | null> {
  if (!idValido(assessmentId)) return null;
  const e = escopoDe(alunoId);
  return withStore<PhotoRecord | null>('readwrite', (store, done) => {
    store.get(photoId(e, assessmentId, pose)).onsuccess = (ev) => {
      const proprio = (ev.target as IDBRequest<PhotoRecord | undefined>).result;
      if (proprio) return done(proprio);
      adotarPrimeiroLegado(store, e, assessmentId, pose, (adotado) => done(adotado));
    };
  });
}

/** As referências das 4 poses de uma avaliação DESTE (dono, cliente) — por chave, sem varrer nem ler blobs. */
export async function getPhotosByAssessment(alunoId: string, assessmentId: string): Promise<AssessmentPhotos> {
  if (!idValido(assessmentId)) return { assessmentId };
  const e = escopoDe(alunoId);
  return withStore<AssessmentPhotos>('readwrite', (store, done) => {
    const resultado: AssessmentPhotos = { assessmentId };
    let pendentes = PHOTO_POSES.length;
    const fim = () => {
      if (--pendentes === 0) done(resultado);
    };
    for (const pose of PHOTO_POSES) {
      const id = photoId(e, assessmentId, pose);
      store.getKey(id).onsuccess = (ev) => {
        if ((ev.target as IDBRequest<IDBValidKey | undefined>).result !== undefined) {
          resultado[pose] = id;
          return fim();
        }
        // Legado: adota no primeiro acesso (get + put/delete na mesma transação).
        adotarPrimeiroLegado(store, e, assessmentId, pose, (adotado) => {
          if (adotado) resultado[pose] = adotado.id;
          fim();
        });
      };
    }
  });
}

/** Remove a foto daquela pose do cliente (e as cópias legadas DELE, se ainda existirem). */
export async function deletePhoto(alunoId: string, assessmentId: string, pose: PhotoPose): Promise<void> {
  if (!idValido(assessmentId)) return;
  const e = escopoDe(alunoId);
  return withStore<void>('readwrite', (store, done) => {
    store.delete(photoId(e, assessmentId, pose));
    apagarLegadosDoCliente(store, e, assessmentId, pose);
    done();
  });
}

/** Remove TODAS as fotos de uma avaliação do cliente (exclusão da avaliação / avaliação nova cancelada / rascunho vencido). */
export async function deletePhotosByAssessment(alunoId: string, assessmentId: string): Promise<void> {
  if (!idValido(assessmentId)) return;
  const e = escopoDe(alunoId);
  return withStore<void>('readwrite', (store, done) => {
    for (const pose of PHOTO_POSES) {
      store.delete(photoId(e, assessmentId, pose));
      apagarLegadosDoCliente(store, e, assessmentId, pose);
    }
    done();
  });
}

/**
 * Remove todas as fotos de um cliente: o namespace atual (dono + cliente) e o legado DELE
 * (L1 do uid atual / L0). Nunca toca o namespace de outro dono. `alunoId` é o id LOCAL do aluno.
 */
export async function deletePhotosByAluno(alunoId: string): Promise<void> {
  const e = escopoDe(alunoId);
  const prefixo = prefixoCliente(e);
  return withStore<void>('readwrite', (store, done) => {
    store.delete(IDBKeyRange.bound(prefixo, `${prefixo}\uffff`));
    store.index('alunoId').getAllKeys(alunoId).onsuccess = (ev) => {
      for (const chave of (ev.target as IDBRequest<IDBValidKey[]>).result) {
        const id = String(chave);
        const partes = id.split(':').length;
        const ehL0 = partes === 1;
        const ehL1Proprio = partes === 2 && !!e.uid && id.startsWith(`${e.uid}:`);
        if (ehL0 || ehL1Proprio) store.delete(chave);
      }
      done();
    };
  });
}

/** Remove TUDO do dono atual (todos os clientes). Para limpeza explícita — nunca chamada automaticamente. */
export async function deletePhotosByOwner(): Promise<void> {
  const owner = currentOwner();
  const prefixo = `${owner}:`;
  return withStore<void>('readwrite', (store, done) => {
    store.delete(IDBKeyRange.bound(prefixo, `${prefixo}\uffff`));
    done();
  });
}

/**
 * Fotos ÓRFÃS do cliente: guardadas no namespace atual, mas de avaliações que NÃO estão em
 * `assessmentIdsConhecidos`. SÓ LISTA (as fotos existem apenas neste aparelho — apagar por
 * heurística é perda irreversível; ex.: avaliação em rascunho ainda não salva, ou lista
 * remota incompleta). Quem decide apagar usa `deletePhotosByAssessment`.
 */
export async function listarFotosOrfas(alunoId: string, assessmentIdsConhecidos: string[]): Promise<string[]> {
  const e = escopoDe(alunoId);
  const prefixo = prefixoCliente(e);
  const conhecidos = new Set(assessmentIdsConhecidos);
  return withStore<string[]>('readonly', (store, done) => {
    store.getAllKeys(IDBKeyRange.bound(prefixo, `${prefixo}\uffff`)).onsuccess = (ev) => {
      const orfas = new Set<string>();
      for (const chave of (ev.target as IDBRequest<IDBValidKey[]>).result) {
        const [assessmentId] = String(chave).slice(prefixo.length).split(':');
        if (assessmentId && !conhecidos.has(assessmentId)) orfas.add(assessmentId);
      }
      done([...orfas]);
    };
  });
}

/** URL local (`createObjectURL`) pra exibir a foto — quem chama deve `revokeObjectURL` depois de usar. */
export async function getPhotoObjectUrl(alunoId: string, assessmentId: string, pose: PhotoPose): Promise<string | null> {
  const registro = await getPhoto(alunoId, assessmentId, pose);
  return registro ? URL.createObjectURL(registro.blob) : null;
}
