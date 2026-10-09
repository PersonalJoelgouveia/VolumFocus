import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLocalOwnerMemory, getLocalOwnerUUID, setLocalAuthUid, setLocalOwner, setLocalOwnerUUID } from '../localOwner';
import {
  deletePhoto,
  deletePhotosByAluno,
  deletePhotosByAssessment,
  getPhoto,
  deletePhotosByOwner,
  getPhotosByAssessment,
  listarFotosOrfas,
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
function semearLegado(assessmentId: string, alunoId: string, pose: string, txt: string, idRegistro?: string): Promise<void> {
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
        id: idRegistro ?? `${assessmentId}_${pose}`, assessmentId, alunoId, pose, blob: blob(txt),
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

const UA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

/** Simula o login autorizado: uid do Firebase + ownerUUID resolvido (+ uid legado L1). */
function entrar(uid: string, ownerUUID: string): void {
  setLocalAuthUid(uid);
  setLocalOwnerUUID(uid, ownerUUID);
  setLocalOwner(uid);
}
function sair(): void {
  setLocalAuthUid(null);
  clearLocalOwnerMemory();
}

describe.skipIf(!disponivel)('assessmentPhotoStore — isolamento por ownerUUID + alunoId', () => {
  beforeEach(async () => {
    sair();
    await new Promise<void>((resolve) => {
      const r = indexedDB.deleteDatabase(DB);
      r.onsuccess = () => resolve();
      r.onerror = () => resolve();
    });
  });
  afterEach(() => sair());

  it('sem sessão autorizada / sem ownerUUID, nada é lido nem gravado', async () => {
    await expect(getPhotosByAssessment('al-1', 'af-1')).rejects.toThrow();
    await expect(savePhoto('al-1', 'af-1', 'front', blob('x'), dim)).rejects.toThrow();
    setLocalAuthUid('uidA'); // autenticado, mas ownerUUID ainda não resolvido
    await expect(getPhoto('al-1', 'af-1', 'front')).rejects.toThrow();
  });

  it('chave = ownerUUID:alunoId:assessmentId:pose', async () => {
    entrar('uidA', UA);
    await savePhoto('al-1', 'af-1', 'front', blob('x'), dim);
    expect(await chavesDoBanco()).toEqual([`${UA}:al-1:af-1:front`]);
  });

  it('A/Cliente A → fotos A · A/Cliente B → fotos B (mesmo assessmentId não mistura clientes)', async () => {
    entrar('uidA', UA);
    await savePhoto('al-A', 'af-1', 'front', blob('foto-clienteA'), dim);
    await savePhoto('al-B', 'af-1', 'front', blob('foto-clienteB'), dim);
    expect(await lerTexto((await getPhoto('al-A', 'af-1', 'front'))!.blob)).toBe('foto-clienteA');
    expect(await lerTexto((await getPhoto('al-B', 'af-1', 'front'))!.blob)).toBe('foto-clienteB');
    expect(await getPhoto('al-C', 'af-1', 'front')).toBeNull(); // cliente sem foto
    expect(Object.keys(await getPhotosByAssessment('al-A', 'af-1')).sort()).toEqual(['assessmentId', 'front']);
  });

  it('B/Cliente A → negado (não lê, não lista, não sobrescreve, não apaga) · B/Cliente B → fotos B', async () => {
    entrar('uidA', UA);
    await savePhoto('al-A', 'af-1', 'front', blob('foto-de-A'), dim);

    entrar('uidB', UB);
    expect(await getPhoto('al-A', 'af-1', 'front')).toBeNull();
    expect(await getPhotosByAssessment('al-A', 'af-1')).toEqual({ assessmentId: 'af-1' });
    await savePhoto('al-A', 'af-1', 'front', blob('B-tentando-sobrescrever'), dim); // vai para o namespace de B
    await deletePhoto('al-A', 'af-1', 'front');
    await deletePhotosByAssessment('al-A', 'af-1');
    await deletePhotosByAluno('al-A');
    await deletePhotosByOwner();

    await savePhoto('al-B', 'af-2', 'front', blob('foto-de-B'), dim);
    expect(await lerTexto((await getPhoto('al-B', 'af-2', 'front'))!.blob)).toBe('foto-de-B');

    entrar('uidA', UA);
    expect(await lerTexto((await getPhoto('al-A', 'af-1', 'front'))!.blob)).toBe('foto-de-A'); // intacta
  });

  it('troca de conta: ao sair, nada fica acessível; cache de OUTRA conta não é herdado', async () => {
    entrar('uidA', UA);
    await savePhoto('al-A', 'af-1', 'front', blob('a'), dim);
    sair();
    await expect(getPhoto('al-A', 'af-1', 'front')).rejects.toThrow();
    setLocalAuthUid('uidB'); // B entra; o ownerUUID de A não pode vazar
    expect(getLocalOwnerUUID()).toBeNull();
    setLocalOwnerUUID('uidA', UA); // valor de outro uid é ignorado
    expect(getLocalOwnerUUID()).toBeNull();
  });

  it('substituir a foto da mesma pose mantém um único registro', async () => {
    entrar('uidA', UA);
    await savePhoto('al-1', 'af-1', 'front', blob('v1'), dim);
    await savePhoto('al-1', 'af-1', 'front', blob('v2'), dim);
    expect(await lerTexto((await getPhoto('al-1', 'af-1', 'front'))!.blob)).toBe('v2');
    expect(await chavesDoBanco()).toEqual([`${UA}:al-1:af-1:front`]);
  });

  it('LEGADO L0 (sem dono) é adotado só pelo cliente certo (alunoId confere) e some do formato antigo', async () => {
    await semearLegado('af-7', 'al-7', 'front', 'legado');
    entrar('uidA', UA);
    expect(await getPhotosByAssessment('al-OUTRO', 'af-7')).toEqual({ assessmentId: 'af-7' }); // outro cliente: não adota
    expect(await chavesDoBanco()).toEqual(['af-7_front']);
    expect((await getPhotosByAssessment('al-7', 'af-7')).front).toBe(`${UA}:al-7:af-7:front`);
    expect(await chavesDoBanco()).toEqual([`${UA}:al-7:af-7:front`]);
    entrar('uidB', UB); // depois da adoção, B não alcança
    expect(await getPhoto('al-7', 'af-7', 'front')).toBeNull();
  });

  it('LEGADO L1 (uid:assessmentId_pose) é migrado para a chave nova, preservando o blob', async () => {
    await semearLegado('af-9', 'al-9', 'back', 'foto-l1', 'uidA:af-9_back');
    entrar('uidA', UA);
    expect(await lerTexto((await getPhoto('al-9', 'af-9', 'back'))!.blob)).toBe('foto-l1');
    expect(await chavesDoBanco()).toEqual([`${UA}:al-9:af-9:back`]);
  });

  it('L1 de OUTRO uid nunca é adotado', async () => {
    await semearLegado('af-9', 'al-9', 'back', 'foto-de-uidB', 'uidB:af-9_back');
    entrar('uidA', UA);
    expect(await getPhoto('al-9', 'af-9', 'back')).toBeNull();
    expect(await chavesDoBanco()).toEqual(['uidB:af-9_back']);
  });

  it('excluir (foto/avaliação) remove a cópia legada DO CLIENTE e preserva a de outro; salvar por cima evita reaparecer', async () => {
    await semearLegado('af-3', 'al-3', 'front', 'velho');
    entrar('uidA', UA);
    await deletePhoto('al-OUTRO', 'af-3', 'front');
    expect(await chavesDoBanco()).toEqual(['af-3_front']); // não era dele
    await deletePhoto('al-3', 'af-3', 'front');
    expect(await chavesDoBanco()).toEqual([]);

    await semearLegado('af-4', 'al-4', 'front', 'velho');
    await savePhoto('al-4', 'af-4', 'front', blob('novo'), dim);
    expect(await chavesDoBanco()).toEqual([`${UA}:al-4:af-4:front`]);
  });

  it('deletePhotosByAssessment apaga as poses da avaliação daquele cliente e só elas', async () => {
    entrar('uidA', UA);
    await savePhoto('al-1', 'af-1', 'front', blob('a'), dim);
    await savePhoto('al-1', 'af-1', 'back', blob('b'), dim);
    await savePhoto('al-1', 'af-2', 'front', blob('c'), dim);
    await savePhoto('al-2', 'af-1', 'front', blob('d'), dim);
    await deletePhotosByAssessment('al-1', 'af-1');
    expect(await chavesDoBanco()).toEqual([`${UA}:al-1:af-2:front`, `${UA}:al-2:af-1:front`]);
  });

  it('deletePhotosByAluno: só o cliente (dono atual + legado dele); preserva outros clientes e outro dono com o mesmo alunoId', async () => {
    await semearLegado('af-5', 'al-5', 'front', 'legado');
    entrar('uidA', UA);
    await savePhoto('al-5', 'af-6', 'front', blob('a'), dim);
    await savePhoto('al-OUTRO', 'af-10', 'front', blob('outro'), dim);
    entrar('uidB', UB);
    await savePhoto('al-5', 'af-11', 'front', blob('de-B-mesmo-alunoId'), dim);

    entrar('uidA', UA);
    await deletePhotosByAluno('al-5');
    expect(await chavesDoBanco()).toEqual([`${UA}:al-OUTRO:af-10:front`, `${UB}:al-5:af-11:front`]);
  });

  it('ids forjados com ":" não colidem: alunoId é codificado; assessmentId com ":" é recusado', async () => {
    entrar('uidB', UB);
    await savePhoto('al-9', 'af-1', 'front', blob('foto-de-B'), dim);
    entrar('uidA', UA);
    await savePhoto('al-1', 'af-1', 'front', blob('a1'), dim);
    // alunoId que tenta "caber" dentro da chave de outro cliente/avaliação
    await savePhoto('al-1:af-1', 'af-2', 'front', blob('forjado'), dim);
    expect(await lerTexto((await getPhoto('al-1', 'af-1', 'front'))!.blob)).toBe('a1');
    expect(await getPhoto('al-1:af-1', 'af-1', 'front')).toBeNull();
    // assessmentId forjado
    expect(await getPhoto('al-9', `${UB}:al-9:af-1`, 'front')).toBeNull();
    await expect(savePhoto('al-1', 'af-1:x', 'front', blob('x'), dim)).rejects.toThrow();
    await expect(savePhoto('', 'af-1', 'front', blob('x'), dim)).rejects.toThrow();
    expect((await chavesDoBanco()).filter((k) => k.startsWith(UB))).toEqual([`${UB}:al-9:af-1:front`]);
  });

  it('listarFotosOrfas só LISTA (não apaga) avaliações desconhecidas do cliente', async () => {
    entrar('uidA', UA);
    await savePhoto('al-1', 'af-ok', 'front', blob('a'), dim);
    await savePhoto('al-1', 'af-sumiu', 'front', blob('b'), dim);
    await savePhoto('al-2', 'af-outro-cliente', 'front', blob('c'), dim);
    expect(await listarFotosOrfas('al-1', ['af-ok'])).toEqual(['af-sumiu']);
    expect((await chavesDoBanco()).length).toBe(3);
  });

  it('cache de ownerUUID por uid (abre offline) e invalidado ao sair', async () => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    });
    entrar('uidA', UA);
    expect(mem.has('jg3_owner_uuid')).toBe(true);
    // "reabre o app" offline: memória zerada, cache do MESMO uid vale
    setLocalAuthUid('uidX');
    setLocalAuthUid('uidA');
    expect(getLocalOwnerUUID()).toBe(UA);
    // outra conta com o cache de A no disco: não herda
    setLocalAuthUid('uidB');
    expect(getLocalOwnerUUID()).toBeNull();
    sair();
    expect(mem.has('jg3_owner_uuid')).toBe(false);
    vi.unstubAllGlobals();
  });

  it('não deixa conexões abertas (deleteDatabase não fica bloqueado)', async () => {
    entrar('uidA', UA);
    await savePhoto('al-1', 'af-1', 'front', blob('a'), dim);
    await getPhotosByAssessment('al-1', 'af-1');
    await getPhoto('al-1', 'af-1', 'front');
    const bloqueado = await new Promise<boolean>((resolve) => {
      const r = indexedDB.deleteDatabase(DB);
      r.onblocked = () => resolve(true);
      r.onsuccess = () => resolve(false);
    });
    expect(bloqueado).toBe(false);
  });
});
