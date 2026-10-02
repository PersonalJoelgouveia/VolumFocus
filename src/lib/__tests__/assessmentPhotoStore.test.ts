import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearLocalOwnerMemory, setLocalOwner } from '../localOwner';
import {
  deletePhoto,
  deletePhotosByAluno,
  deletePhotosByAssessment,
  getPhoto,
  getPhotosByAssessment,
  savePhoto,
} from '../assessmentPhotoStore';

/**
 * Estes testes precisam de um IndexedDB em Node. O projeto não o tem como
 * dependência: sem `fake-indexeddb` (npm i -D fake-indexeddb) a suíte é
 * PULADA — não falha. No navegador real, rode os cenários manuais.
 */
const FAKE_IDB = 'fake-indexeddb/auto';
let disponivel = true;
try {
  await import(/* @vite-ignore */ FAKE_IDB);
} catch {
  disponivel = false;
}

const DB = 'volumfocus-assessment-media';
const dim = { width: 10, height: 20 };
const blob = (txt: string) => new Blob([txt], { type: 'image/jpeg' });

async function lerTexto(b: Blob): Promise<string> {
  return new Response(b).text();
}

/** Insere um registro no formato ANTERIOR ao namespace (id sem dono). */
function semearLegado(assessmentId: string, alunoId: string, pose: string, txt: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore('assessment-photos', { keyPath: 'id' });
      store.createIndex('assessmentId', 'assessmentId', { unique: false });
      store.createIndex('alunoId', 'alunoId', { unique: false });
    };
    req.onsuccess = () => {
      const tx = req.result.transaction('assessment-photos', 'readwrite');
      tx.objectStore('assessment-photos').put({
        id: `${assessmentId}_${pose}`, assessmentId, alunoId, pose, blob: blob(txt),
        createdAt: new Date().toISOString(), mimeType: 'image/jpeg', ...dim,
      });
      tx.oncomplete = () => { req.result.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  });
}

function chavesDoBanco(): Promise<string[]> {
  return new Promise((resolve) => {
    const req = indexedDB.open(DB);
    req.onsuccess = () => {
      const q = req.result.transaction('assessment-photos').objectStore('assessment-photos').getAllKeys();
      q.onsuccess = () => { req.result.close(); resolve(q.result.map(String).sort()); };
    };
  });
}

describe.skipIf(!disponivel)('assessmentPhotoStore — isolamento por dono', () => {
  beforeEach(async () => {
    clearLocalOwnerMemory();
    await new Promise<void>((resolve) => {
      const r = indexedDB.deleteDatabase(DB);
      r.onsuccess = () => resolve();
      r.onerror = () => resolve();
    });
  });
  afterEach(() => clearLocalOwnerMemory());

  it('sem conta autenticada, nada é lido nem gravado', async () => {
    await expect(getPhotosByAssessment('af-1')).rejects.toThrow();
    await expect(savePhoto('al-1', 'af-1', 'front', blob('x'), dim)).rejects.toThrow();
  });

  it('B não lê, não lista, não sobrescreve e não apaga a foto de A (mesmo conhecendo o assessmentId)', async () => {
    setLocalOwner('uidA');
    await savePhoto('al-1', 'af-1', 'front', blob('foto-de-A'), dim);

    setLocalOwner('uidB');
    expect(await getPhoto('af-1', 'front')).toBeNull();
    expect(await getPhotosByAssessment('af-1')).toEqual({ assessmentId: 'af-1' });

    await savePhoto('al-9', 'af-1', 'front', blob('foto-de-B'), dim); // mesmo id de avaliação
    await deletePhoto('af-1', 'front');
    await deletePhotosByAssessment('af-1');
    await deletePhotosByAluno('al-1');

    setLocalOwner('uidA');
    const a = await getPhoto('af-1', 'front');
    expect(a).not.toBeNull();
    expect(await lerTexto(a!.blob)).toBe('foto-de-A');
  });

  it('A lê suas fotos entre clientes sem misturar avaliações', async () => {
    setLocalOwner('uidA');
    await savePhoto('al-1', 'af-1', 'front', blob('c1-frente'), dim);
    await savePhoto('al-2', 'af-2', 'front', blob('c2-frente'), dim);
    expect(await lerTexto((await getPhoto('af-1', 'front'))!.blob)).toBe('c1-frente');
    expect(await lerTexto((await getPhoto('af-2', 'front'))!.blob)).toBe('c2-frente');
    expect(Object.keys(await getPhotosByAssessment('af-1')).sort()).toEqual(['assessmentId', 'front']);
  });

  it('substituir a foto da mesma pose mantém um único registro', async () => {
    setLocalOwner('uidA');
    await savePhoto('al-1', 'af-1', 'front', blob('v1'), dim);
    await savePhoto('al-1', 'af-1', 'front', blob('v2'), dim);
    expect(await lerTexto((await getPhoto('af-1', 'front'))!.blob)).toBe('v2');
    expect(await chavesDoBanco()).toEqual(['uidA:af-1_front']);
  });

  it('registro legado é adotado por quem o acessa pelo assessmentId e some do formato antigo', async () => {
    await semearLegado('af-7', 'al-7', 'front', 'legado');
    setLocalOwner('uidA');
    expect((await getPhotosByAssessment('af-7')).front).toBe('uidA:af-7_front');
    expect(await chavesDoBanco()).toEqual(['uidA:af-7_front']);

    setLocalOwner('uidB'); // depois da adoção, B não alcança
    expect(await getPhoto('af-7', 'front')).toBeNull();
  });

  it('getPhoto também adota legado (leitura direta)', async () => {
    await semearLegado('af-8', 'al-8', 'back', 'legado-b');
    setLocalOwner('uidA');
    expect(await lerTexto((await getPhoto('af-8', 'back'))!.blob)).toBe('legado-b');
    expect(await chavesDoBanco()).toEqual(['uidA:af-8_back']);
  });

  it('excluir a foto (ou a avaliação) também remove a cópia legada; salvar por cima evita o reaparecimento', async () => {
    await semearLegado('af-3', 'al-3', 'front', 'velho');
    setLocalOwner('uidA');
    await deletePhoto('af-3', 'front');
    expect(await chavesDoBanco()).toEqual([]);

    await semearLegado('af-4', 'al-4', 'front', 'velho');
    await savePhoto('al-4', 'af-4', 'front', blob('novo'), dim);
    expect(await chavesDoBanco()).toEqual(['uidA:af-4_front']);
    expect(await lerTexto((await getPhoto('af-4', 'front'))!.blob)).toBe('novo');
  });

  it('deletePhotosByAssessment apaga as 4 poses do dono atual e só elas', async () => {
    setLocalOwner('uidA');
    await savePhoto('al-1', 'af-1', 'front', blob('a'), dim);
    await savePhoto('al-1', 'af-1', 'back', blob('b'), dim);
    await savePhoto('al-1', 'af-2', 'front', blob('c'), dim);
    await deletePhotosByAssessment('af-1');
    expect(await chavesDoBanco()).toEqual(['uidA:af-2_front']);
  });

  it('deletePhotosByAluno apaga só fotos do aluno (dono atual + legado) e preserva as de outra conta', async () => {
    await semearLegado('af-5', 'al-5', 'front', 'legado');
    setLocalOwner('uidA');
    await savePhoto('al-5', 'af-6', 'front', blob('a'), dim);
    await savePhoto('al-OUTRO', 'af-10', 'front', blob('outro'), dim);
    setLocalOwner('uidB');
    await savePhoto('al-5', 'af-11', 'front', blob('de-B-mesmo-alunoId'), dim);

    setLocalOwner('uidA');
    await deletePhotosByAluno('al-5');
    expect(await chavesDoBanco()).toEqual(['uidA:af-10_front', 'uidB:af-11_front']);
  });

  it('assessmentId forjado com ":" não alcança nem "adota" a foto de outra conta (via caminho de legado)', async () => {
    setLocalOwner('uidB');
    await savePhoto('al-9', 'af-1', 'front', blob('foto-de-B'), dim);

    setLocalOwner('uidA');
    const forjado = 'uidB:af-1'; // chave legada `${id}_front` == chave namespaced de B
    expect(await getPhoto(forjado, 'front')).toBeNull();
    expect(await getPhotosByAssessment(forjado)).toEqual({ assessmentId: forjado });
    await deletePhoto(forjado, 'front');
    await deletePhotosByAssessment(forjado);
    await expect(savePhoto('al-1', forjado, 'front', blob('x'), dim)).rejects.toThrow();

    expect(await chavesDoBanco()).toEqual(['uidB:af-1_front']); // intacta, no namespace de B
    setLocalOwner('uidB');
    expect(await lerTexto((await getPhoto('af-1', 'front'))!.blob)).toBe('foto-de-B');
  });

  it('não deixa conexões abertas (deleteDatabase não fica bloqueado)', async () => {
    setLocalOwner('uidA');
    await savePhoto('al-1', 'af-1', 'front', blob('a'), dim);
    await getPhotosByAssessment('af-1');
    await getPhoto('af-1', 'front');
    const bloqueado = await new Promise<boolean>((resolve) => {
      const r = indexedDB.deleteDatabase(DB);
      r.onblocked = () => resolve(true);
      r.onsuccess = () => resolve(false);
    });
    expect(bloqueado).toBe(false);
  });
});
